-- Replaces create_campaign_snapshot so ON CONFLICT names the unique constraint.
-- The argument idempotency_key otherwise clashes with the column of the same name.
-- Does not change the signature, checks, duplicate-key behavior, or return columns.

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
  on conflict on constraint campaigns_idempotency_key_key do nothing
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
