-- Hourly limit for the course tutor. No new table or column.

alter table private.ai_request_counters
  drop constraint ai_request_counters_feature_check;

alter table private.ai_request_counters
  add constraint ai_request_counters_feature_check check (
    feature in ('ai-study', 'ai-agent', 'ai-course-builder', 'ai-course-review', 'ai-tutor')
  );

create or replace function private.consume_ai_request(requested_feature text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid;
  feature_limit integer;
  bucket timestamptz;
  allowed boolean;
begin
  caller := auth.uid();
  if caller is null then
    return false;
  end if;

  feature_limit := case requested_feature
    when 'ai-study' then 30
    when 'ai-agent' then 20
    when 'ai-course-builder' then 10
    when 'ai-course-review' then 10
    when 'ai-tutor' then 20
    else null
  end;
  if feature_limit is null then
    return false;
  end if;

  bucket := pg_catalog.date_trunc('hour', pg_catalog.now());

  insert into private.ai_request_counters as counter (user_id, feature, window_start, request_count)
  values (caller, requested_feature, bucket, 1)
  on conflict on constraint ai_request_counters_pkey
  do update
    set request_count = counter.request_count + 1
    where counter.request_count < feature_limit
  returning true into allowed;

  return coalesce(allowed, false);
end;
$$;

revoke all on function private.consume_ai_request(text) from public, anon, service_role;
grant execute on function private.consume_ai_request(text) to authenticated;
