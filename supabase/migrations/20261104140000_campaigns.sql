-- Local until applied. Admin campaign audience, snapshot, and delivery tracking.
-- Does not send mail. Does not change enrolment or certificate email claims.

create table public.email_suppressions (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  student_id uuid references public.profiles (id) on delete restrict,
  reason text not null,
  created_at timestamptz not null default now(),
  constraint email_suppressions_email_check check (
    email = lower(btrim(email))
    and char_length(email) between 3 and 320
  ),
  constraint email_suppressions_reason_check check (reason in ('unsubscribe', 'complaint')),
  constraint email_suppressions_email_key unique (email)
);

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles (id) on delete restrict,
  segment text not null,
  subject text not null,
  body text not null,
  status text not null default 'confirmed',
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  constraint campaigns_segment_check check (segment in ('new', 'active', 'inactive')),
  constraint campaigns_subject_check check (char_length(subject) between 1 and 180),
  constraint campaigns_body_check check (char_length(body) between 1 and 4000),
  constraint campaigns_status_check check (status in ('confirmed', 'sent')),
  constraint campaigns_idempotency_key_check check (char_length(idempotency_key) between 16 and 80),
  constraint campaigns_idempotency_key_key unique (idempotency_key)
);

create table public.campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete restrict,
  student_id uuid not null references public.profiles (id) on delete restrict,
  email text not null,
  segment text not null,
  status text not null default 'pending',
  provider_email_id text,
  sent_at timestamptz,
  reenrolled_at timestamptz,
  created_at timestamptz not null default now(),
  constraint campaign_recipients_segment_check check (segment in ('new', 'active', 'inactive')),
  constraint campaign_recipients_status_check check (
    status in ('pending', 'sent', 'opened', 'bounced', 'failed', 'suppressed')
  ),
  constraint campaign_recipients_email_check check (char_length(btrim(email)) between 3 and 320)
);

create unique index campaign_recipients_campaign_student_uidx
  on public.campaign_recipients (campaign_id, student_id);

create index campaign_recipients_student_id_idx
  on public.campaign_recipients (student_id);

create index campaign_recipients_provider_email_id_idx
  on public.campaign_recipients (provider_email_id)
  where provider_email_id is not null;

create index campaigns_created_by_idx
  on public.campaigns (created_by);

alter table public.email_suppressions enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_recipients enable row level security;

revoke all on table public.email_suppressions from anon, authenticated;
revoke all on table public.campaigns from anon, authenticated;
revoke all on table public.campaign_recipients from anon, authenticated;

grant select on table public.email_suppressions to authenticated;
grant select on table public.campaigns to authenticated;
grant select on table public.campaign_recipients to authenticated;

create policy email_suppressions_select_admin
  on public.email_suppressions
  for select
  to authenticated
  using (public.current_app_role() = 'admin');

create policy campaigns_select_admin
  on public.campaigns
  for select
  to authenticated
  using (public.current_app_role() = 'admin');

create policy campaign_recipients_select_admin
  on public.campaign_recipients
  for select
  to authenticated
  using (public.current_app_role() = 'admin');

create or replace function public.campaign_audience(target_segment text)
returns table (
  student_id uuid,
  email text,
  full_name text,
  segment text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if public.current_app_role() is distinct from 'admin' then
    raise exception 'only an admin can view campaign segments';
  end if;

  if target_segment is not null and target_segment not in ('new', 'active', 'inactive') then
    raise exception 'the campaign segment was not valid';
  end if;

  return query
  select
    classified.student_id,
    classified.email,
    classified.full_name,
    classified.segment
  from (
    select
      profile.id as student_id,
      pg_catalog.btrim(profile.email) as email,
      coalesce(pg_catalog.btrim(profile.full_name), '') as full_name,
      case
        when profile.created_at >= pg_catalog.now() - interval '7 days' then 'new'
        when activity.last_activity >= pg_catalog.now() - interval '30 days' then 'active'
        else 'inactive'
      end as segment
    from public.profiles as profile
    left join (
      select event.student_id, max(event.activity_at) as last_activity
      from (
        select enrollment.student_id, enrollment.created_at as activity_at
        from public.enrollments as enrollment
        union all
        select completion.student_id, completion.created_at
        from public.lesson_completions as completion
        union all
        select submission.student_id, submission.created_at
        from public.submissions as submission
      ) as event
      group by event.student_id
    ) as activity on activity.student_id = profile.id
    where profile.role = 'student'
      and nullif(pg_catalog.btrim(profile.email), '') is not null
      and not exists (
        select 1
        from public.email_suppressions as suppression
        where suppression.email = lower(pg_catalog.btrim(profile.email))
      )
  ) as classified
  where target_segment is null or classified.segment = target_segment;
end;
$$;

revoke all on function public.campaign_audience(text) from public, anon;
grant execute on function public.campaign_audience(text) to authenticated;

create or replace function public.create_campaign_snapshot(
  target_segment text,
  requested_subject text,
  requested_body text,
  idempotency_key text
)
returns table (
  campaign_id uuid,
  recipient_id uuid,
  student_email text,
  recipient_status text,
  campaign_subject text,
  campaign_body text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean_segment text;
  clean_subject text;
  clean_body text;
  clean_key text;
  new_campaign uuid;
  existing_campaign uuid;
  existing_owner uuid;
  existing_status text;
  existing_subject text;
  existing_body text;
begin
  if public.current_app_role() is distinct from 'admin' then
    raise exception 'only an admin can send a campaign';
  end if;

  clean_segment := pg_catalog.btrim(target_segment);
  clean_subject := pg_catalog.btrim(requested_subject);
  clean_body := pg_catalog.btrim(requested_body);
  clean_key := pg_catalog.btrim(idempotency_key);

  if clean_segment is null
    or clean_subject is null
    or clean_body is null
    or clean_key is null
    or clean_segment not in ('new', 'active', 'inactive')
    or char_length(clean_subject) < 1
    or char_length(clean_subject) > 180
    or char_length(clean_body) < 1
    or char_length(clean_body) > 4000
    or clean_key !~ '^[A-Za-z0-9-]{16,80}$' then
    raise exception 'the campaign was not valid';
  end if;

  insert into public.campaigns (created_by, segment, subject, body, idempotency_key)
  values ((select auth.uid()), clean_segment, clean_subject, clean_body, clean_key)
  on conflict (idempotency_key) do nothing
  returning id into new_campaign;

  if new_campaign is null then
    select campaign.id, campaign.created_by, campaign.status, campaign.subject, campaign.body
    into existing_campaign, existing_owner, existing_status, existing_subject, existing_body
    from public.campaigns as campaign
    where campaign.idempotency_key = clean_key;

    if existing_owner is distinct from (select auth.uid()) then
      raise exception 'this campaign key is already in use';
    end if;

    return query
    select
      existing_campaign,
      recipient.id,
      recipient.email,
      recipient.status,
      existing_subject,
      existing_body
    from public.campaign_recipients as recipient
    where recipient.campaign_id = existing_campaign
      and recipient.status = 'pending';

    if found then
      return;
    end if;

    return query
    select
      existing_campaign,
      null::uuid,
      null::text,
      existing_status,
      existing_subject,
      existing_body;
    return;
  end if;

  insert into public.campaign_recipients (campaign_id, student_id, email, segment)
  select new_campaign, audience.student_id, audience.email, audience.segment
  from public.campaign_audience(clean_segment) as audience;

  if not found then
    update public.campaigns as campaign
    set status = 'sent', sent_at = pg_catalog.now()
    where campaign.id = new_campaign;

    return query
    select new_campaign, null::uuid, null::text, 'sent'::text, clean_subject, clean_body;
    return;
  end if;

  return query
  select
    new_campaign,
    recipient.id,
    recipient.email,
    recipient.status,
    clean_subject,
    clean_body
  from public.campaign_recipients as recipient
  where recipient.campaign_id = new_campaign
    and recipient.status = 'pending';
end;
$$;

revoke all on function public.create_campaign_snapshot(text, text, text, text) from public, anon;
grant execute on function public.create_campaign_snapshot(text, text, text, text) to authenticated;

create or replace function public.mark_campaign_recipient_sent(
  target_recipient uuid,
  provider_email_id text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean_id text;
begin
  if public.current_app_role() is distinct from 'admin' then
    raise exception 'only an admin can send a campaign';
  end if;

  clean_id := pg_catalog.btrim(provider_email_id);
  if clean_id = '' or char_length(clean_id) > 200 then
    return false;
  end if;

  update public.campaign_recipients as recipient
  set
    status = 'sent',
    provider_email_id = clean_id,
    sent_at = pg_catalog.now()
  from public.campaigns as campaign
  where recipient.id = target_recipient
    and recipient.campaign_id = campaign.id
    and campaign.created_by = (select auth.uid())
    and recipient.status = 'pending'
    and recipient.provider_email_id is null;

  return found;
end;
$$;

revoke all on function public.mark_campaign_recipient_sent(uuid, text) from public, anon;
grant execute on function public.mark_campaign_recipient_sent(uuid, text) to authenticated;

create or replace function public.mark_campaign_recipient_failed(target_recipient uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.current_app_role() is distinct from 'admin' then
    raise exception 'only an admin can send a campaign';
  end if;

  update public.campaign_recipients as recipient
  set status = 'failed'
  from public.campaigns as campaign
  where recipient.id = target_recipient
    and recipient.campaign_id = campaign.id
    and campaign.created_by = (select auth.uid())
    and recipient.status = 'pending'
    and recipient.provider_email_id is null;

  return found;
end;
$$;

revoke all on function public.mark_campaign_recipient_failed(uuid) from public, anon;
grant execute on function public.mark_campaign_recipient_failed(uuid) to authenticated;

create or replace function public.finish_campaign(target_campaign uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.current_app_role() is distinct from 'admin' then
    raise exception 'only an admin can send a campaign';
  end if;

  update public.campaigns as campaign
  set status = 'sent', sent_at = pg_catalog.now()
  where campaign.id = target_campaign
    and campaign.created_by = (select auth.uid())
    and campaign.status = 'confirmed'
    and not exists (
      select 1
      from public.campaign_recipients as recipient
      where recipient.campaign_id = campaign.id
        and recipient.status = 'pending'
    );

  return found;
end;
$$;

revoke all on function public.finish_campaign(uuid) from public, anon;
grant execute on function public.finish_campaign(uuid) to authenticated;

create or replace function public.apply_campaign_delivery(
  provider_email_id text,
  next_status text,
  suppress_reason text,
  suppress_email text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean_id text;
  clean_reason text;
  clean_email text;
begin
  if coalesce(auth.role(), '') is distinct from 'service_role' then
    raise exception 'only the delivery webhook can record campaign delivery';
  end if;

  clean_id := pg_catalog.btrim(coalesce(provider_email_id, ''));
  clean_reason := nullif(pg_catalog.btrim(coalesce(suppress_reason, '')), '');
  clean_email := nullif(lower(pg_catalog.btrim(coalesce(suppress_email, ''))), '');

  if next_status is not null and next_status not in ('opened', 'bounced', 'failed') then
    raise exception 'the delivery status was not valid';
  end if;

  if clean_reason is not null and clean_reason not in ('unsubscribe', 'complaint') then
    raise exception 'the suppression reason was not valid';
  end if;

  if next_status is not null and clean_id <> '' and char_length(clean_id) <= 200 then
    update public.campaign_recipients as recipient
    set status = next_status
    where recipient.provider_email_id = clean_id
      and (
        (next_status = 'opened' and recipient.status = 'sent')
        or (next_status = 'bounced' and recipient.status = 'sent')
        or (next_status = 'failed' and recipient.status in ('pending', 'sent'))
      );
  end if;

  if clean_reason is not null and clean_email is not null
    and char_length(clean_email) between 3 and 320 then
    insert into public.email_suppressions (email, reason)
    values (clean_email, clean_reason)
    on conflict (email) do nothing;
  end if;
end;
$$;

revoke all on function public.apply_campaign_delivery(text, text, text, text) from public, anon, authenticated;
grant execute on function public.apply_campaign_delivery(text, text, text, text) to service_role;

create or replace function public.mark_campaign_reenrolment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.campaign_recipients as recipient
  set reenrolled_at = new.created_at
  where recipient.student_id = new.student_id
    and recipient.sent_at is not null
    and recipient.sent_at < new.created_at
    and recipient.reenrolled_at is null
    and recipient.status in ('sent', 'opened', 'bounced');

  return new;
end;
$$;

revoke all on function public.mark_campaign_reenrolment() from public, anon, authenticated;

create trigger enrollments_mark_campaign_reenrolment
  after insert on public.enrollments
  for each row execute function public.mark_campaign_reenrolment();
