-- Local until applied. Claims one outbound enrolment or certificate email,
-- and stores one inbound Resend delivery event per Svix id.
-- Does not send mail. Does not change enrollments, certificates, or notifications.

create table public.email_events (
  id uuid primary key default gen_random_uuid(),
  event_key text not null,
  student_id uuid references public.profiles (id) on delete restrict,
  kind text not null,
  status text not null,
  provider_email_id text,
  created_at timestamptz not null default now(),
  constraint email_events_kind_status_check check (
    (
      kind = 'outbound'
      and student_id is not null
      and status in ('pending', 'sent')
    )
    or (
      kind = 'delivery'
      and student_id is null
      and status in ('email.sent', 'email.delivered', 'email.bounced', 'email.complained')
    )
  )
);

create unique index email_events_event_key_uidx
  on public.email_events (event_key);

create index email_events_student_id_idx
  on public.email_events (student_id);

alter table public.email_events enable row level security;

revoke all on table public.email_events from anon, authenticated;

grant select, insert, delete on table public.email_events to authenticated;
grant update (status, provider_email_id) on table public.email_events to authenticated;

-- The delivery webhook inserts with the service role after the signature check.
grant select, insert on table public.email_events to service_role;

create or replace function public.owns_email_claim(claim_key text, claim_student uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.enrollments as enrollment
    where enrollment.student_id = claim_student
      and (
        claim_key = 'enrolment:' || enrollment.id::text
        or (
          claim_key = 'certificate:' || enrollment.id::text
          and enrollment.status = 'completed'
        )
      )
  );
$$;

revoke all on function public.owns_email_claim(text, uuid) from public, anon;
grant execute on function public.owns_email_claim(text, uuid) to authenticated;

create policy email_events_select_own
  on public.email_events
  for select
  to authenticated
  using (student_id = (select auth.uid()));

create policy email_events_insert_own
  on public.email_events
  for insert
  to authenticated
  with check (
    kind = 'outbound'
    and status = 'pending'
    and provider_email_id is null
    and student_id = (select auth.uid())
    and public.owns_email_claim(event_key, student_id)
  );

create policy email_events_update_own_sent
  on public.email_events
  for update
  to authenticated
  using (
    student_id = (select auth.uid())
    and kind = 'outbound'
    and status = 'pending'
    and provider_email_id is null
  )
  with check (
    student_id = (select auth.uid())
    and kind = 'outbound'
    and status = 'sent'
    and provider_email_id is not null
  );

create policy email_events_delete_own_pending
  on public.email_events
  for delete
  to authenticated
  using (
    student_id = (select auth.uid())
    and kind = 'outbound'
    and status = 'pending'
    and provider_email_id is null
  );
