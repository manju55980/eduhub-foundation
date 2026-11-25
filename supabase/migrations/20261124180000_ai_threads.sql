-- Saved chats for the learning assistant, study companion, course tutor,
-- course builder, and admin course review. The caller writes as themselves.
-- No service-role key. A turn is two messages. Eight messages fills the window.

create or replace function private.ai_surface_allowed(target_surface text)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select case target_surface
    when 'assistant' then private.current_app_role() = 'student'
    when 'study' then private.current_app_role() = 'student'
    when 'tutor' then private.current_app_role() = 'student'
    when 'course_builder' then private.current_app_role() = 'instructor'
    when 'course_review' then private.current_app_role() = 'admin'
    else false
  end;
$$;

revoke all on function private.ai_surface_allowed(text) from public, anon;
grant execute on function private.ai_surface_allowed(text) to authenticated;

create table public.ai_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  surface text not null check (
    surface in ('assistant', 'study', 'tutor', 'course_builder', 'course_review')
  ),
  course_id uuid references public.courses (id) on delete cascade,
  title text not null default 'New chat',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_threads_course_check check (
    (
      surface in ('assistant', 'course_builder')
      and course_id is null
    )
    or (
      surface in ('study', 'tutor', 'course_review')
      and course_id is not null
    )
  )
);

create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.ai_threads (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 1000),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint ai_messages_payload_object check (jsonb_typeof(payload) = 'object')
);

create index ai_threads_owner_idx
  on public.ai_threads (user_id, surface, updated_at desc);

create index ai_messages_thread_idx
  on public.ai_messages (thread_id, created_at);

alter table public.ai_threads enable row level security;
alter table public.ai_messages enable row level security;

revoke all on table public.ai_threads from anon, authenticated;
revoke all on table public.ai_messages from anon, authenticated;

grant select, insert, update on table public.ai_threads to authenticated;
grant select, insert, delete on table public.ai_messages to authenticated;

create policy ai_threads_select_own
  on public.ai_threads
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    and private.ai_surface_allowed(surface)
  );

create policy ai_threads_insert_own
  on public.ai_threads
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and private.ai_surface_allowed(surface)
  );

create policy ai_threads_update_own
  on public.ai_threads
  for update
  to authenticated
  using (
    user_id = (select auth.uid())
    and private.ai_surface_allowed(surface)
  )
  with check (
    user_id = (select auth.uid())
    and private.ai_surface_allowed(surface)
  );

create policy ai_messages_select_own
  on public.ai_messages
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.ai_threads as thread
      where thread.id = ai_messages.thread_id
        and thread.user_id = (select auth.uid())
        and private.ai_surface_allowed(thread.surface)
    )
  );

create policy ai_messages_insert_turn
  on public.ai_messages
  for insert
  to authenticated
  with check (
    pg_catalog.current_setting('ai.append_turn', true) = 'yes'
    and exists (
      select 1
      from public.ai_threads as thread
      where thread.id = thread_id
        and thread.user_id = (select auth.uid())
        and private.ai_surface_allowed(thread.surface)
    )
  );

create policy ai_messages_delete_own
  on public.ai_messages
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.ai_threads as thread
      where thread.id = ai_messages.thread_id
        and thread.user_id = (select auth.uid())
        and private.ai_surface_allowed(thread.surface)
    )
  );

create or replace function private.protect_ai_thread_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
    or new.user_id is distinct from old.user_id
    or new.surface is distinct from old.surface
    or new.course_id is distinct from old.course_id
    or new.created_at is distinct from old.created_at then
    raise exception 'This chat cannot be changed.';
  end if;
  return new;
end;
$$;

revoke all on function private.protect_ai_thread_identity() from public, anon;
grant execute on function private.protect_ai_thread_identity() to authenticated;

create trigger ai_threads_protect_identity
  before update on public.ai_threads
  for each row execute function private.protect_ai_thread_identity();

create or replace function private.limit_ai_message_count()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  existing integer;
begin
  perform 1
  from public.ai_threads
  where id = new.thread_id
  for update;

  select count(*)::integer
  into existing
  from public.ai_messages
  where thread_id = new.thread_id;

  if existing >= 8 then
    raise exception 'This chat is full. Clear it or start a new chat.';
  end if;
  return new;
end;
$$;

revoke all on function private.limit_ai_message_count() from public, anon;
grant execute on function private.limit_ai_message_count() to authenticated;

create trigger ai_messages_limit_count
  before insert on public.ai_messages
  for each row execute function private.limit_ai_message_count();

create or replace function public.append_ai_turn(
  target_thread_id uuid,
  user_content text,
  assistant_content text,
  assistant_payload jsonb,
  slots_needed integer
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  owner uuid;
  existing integer;
  trimmed_user text;
  trimmed_assistant text;
  stored_payload jsonb;
begin
  if auth.uid() is null then
    raise exception 'You need to be signed in.';
  end if;
  if slots_needed is distinct from 2 and slots_needed is distinct from 4 then
    raise exception 'The request was not valid.';
  end if;

  select user_id
  into owner
  from public.ai_threads
  where id = target_thread_id
  for update;

  if owner is null then
    raise exception 'This chat is not available.';
  end if;

  trimmed_user := pg_catalog.left(pg_catalog.btrim(coalesce(user_content, '')), 1000);
  trimmed_assistant := pg_catalog.left(pg_catalog.btrim(coalesce(assistant_content, '')), 1000);
  if trimmed_user = '' or trimmed_assistant = '' then
    raise exception 'Enter a question.';
  end if;

  if assistant_payload is null or pg_catalog.jsonb_typeof(assistant_payload) is distinct from 'object' then
    stored_payload := '{}'::jsonb;
  else
    stored_payload := assistant_payload;
  end if;

  select count(*)::integer
  into existing
  from public.ai_messages
  where thread_id = target_thread_id;

  if existing + slots_needed > 8 then
    raise exception 'This chat is full. Clear it or start a new chat.';
  end if;

  perform pg_catalog.set_config('ai.append_turn', 'yes', true);

  if existing = 0 then
    update public.ai_threads
    set title = pg_catalog.left(trimmed_user, 80),
        updated_at = pg_catalog.now()
    where id = target_thread_id;
  else
    update public.ai_threads
    set updated_at = pg_catalog.now()
    where id = target_thread_id;
  end if;

  insert into public.ai_messages (thread_id, role, content, payload)
  values (target_thread_id, 'user', trimmed_user, '{}'::jsonb);

  insert into public.ai_messages (thread_id, role, content, payload)
  values (target_thread_id, 'assistant', trimmed_assistant, stored_payload);

  return existing + 2;
end;
$$;

revoke all on function public.append_ai_turn(uuid, text, text, jsonb, integer) from public, anon;
grant execute on function public.append_ai_turn(uuid, text, text, jsonb, integer) to authenticated;

notify pgrst, 'reload schema';
