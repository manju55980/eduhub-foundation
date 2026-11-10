-- Hourly per-user counters for the four Gemini Edge Functions.
-- The table and the security-definer increment stay in private.
-- PostgREST exposes only the public invoker wrapper.

create table private.ai_request_counters (
  user_id uuid not null,
  feature text not null,
  window_start timestamptz not null,
  request_count integer not null,
  constraint ai_request_counters_pkey primary key (user_id, feature, window_start),
  constraint ai_request_counters_feature_check check (
    feature in ('ai-study', 'ai-agent', 'ai-course-builder', 'ai-course-review')
  ),
  constraint ai_request_counters_count_check check (request_count > 0)
);

alter table private.ai_request_counters enable row level security;

revoke all on table private.ai_request_counters from public, anon, authenticated, service_role;

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
grant usage on schema private to authenticated;
grant execute on function private.consume_ai_request(text) to authenticated;

create or replace function public.consume_ai_request(requested_feature text)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  return private.consume_ai_request(requested_feature);
end;
$$;

revoke all on function public.consume_ai_request(text) from public, anon, service_role;
grant execute on function public.consume_ai_request(text) to authenticated;

notify pgrst, 'reload schema';
