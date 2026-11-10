-- Moves the nine policy-only helpers out of the exposed public schema.
-- SET SCHEMA keeps each function OID, so existing policies stay bound.
-- Rewrites function source that still names public.<helper>.
-- Does not change helper signatures, attributes, or the six admin RPCs.

create schema if not exists private;

revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

alter function public.current_app_role() set schema private;
alter function public.is_course_owner(uuid) set schema private;
alter function public.is_enrolled(uuid) set schema private;
alter function public.is_published_course(uuid) set schema private;
alter function public.is_draft_course(uuid) set schema private;
alter function public.is_pending_course(uuid) set schema private;
alter function public.lesson_course_id(uuid) set schema private;
alter function public.storage_course_id(text) set schema private;
alter function public.owns_email_claim(text, uuid) set schema private;

revoke all on function private.current_app_role() from public, anon;
revoke all on function private.is_course_owner(uuid) from public, anon;
revoke all on function private.is_enrolled(uuid) from public, anon;
revoke all on function private.is_published_course(uuid) from public, anon;
revoke all on function private.is_draft_course(uuid) from public, anon;
revoke all on function private.is_pending_course(uuid) from public, anon;
revoke all on function private.lesson_course_id(uuid) from public, anon;
revoke all on function private.storage_course_id(text) from public, anon;
revoke all on function private.owns_email_claim(text, uuid) from public, anon;

grant execute on function private.current_app_role() to authenticated;
grant execute on function private.is_course_owner(uuid) to authenticated;
grant execute on function private.is_enrolled(uuid) to authenticated;
grant execute on function private.is_published_course(uuid) to authenticated;
grant execute on function private.is_draft_course(uuid) to authenticated;
grant execute on function private.is_pending_course(uuid) to authenticated;
grant execute on function private.lesson_course_id(uuid) to authenticated;
grant execute on function private.storage_course_id(text) to authenticated;
grant execute on function private.owns_email_claim(text, uuid) to authenticated;

do $move$
declare
  fn oid;
  definition text;
begin
  for fn in
    select p.oid
    from pg_catalog.pg_proc as p
    join pg_catalog.pg_namespace as n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and (
        p.prosrc like '%public.current_app_role(%'
        or p.prosrc like '%public.is_course_owner(%'
        or p.prosrc like '%public.is_enrolled(%'
        or p.prosrc like '%public.is_published_course(%'
        or p.prosrc like '%public.is_draft_course(%'
        or p.prosrc like '%public.is_pending_course(%'
        or p.prosrc like '%public.lesson_course_id(%'
        or p.prosrc like '%public.storage_course_id(%'
        or p.prosrc like '%public.owns_email_claim(%'
      )
  loop
    definition := pg_catalog.pg_get_functiondef(fn);
    definition := replace(definition, 'public.current_app_role(', 'private.current_app_role(');
    definition := replace(definition, 'public.is_course_owner(', 'private.is_course_owner(');
    definition := replace(definition, 'public.is_enrolled(', 'private.is_enrolled(');
    definition := replace(definition, 'public.is_published_course(', 'private.is_published_course(');
    definition := replace(definition, 'public.is_draft_course(', 'private.is_draft_course(');
    definition := replace(definition, 'public.is_pending_course(', 'private.is_pending_course(');
    definition := replace(definition, 'public.lesson_course_id(', 'private.lesson_course_id(');
    definition := replace(definition, 'public.storage_course_id(', 'private.storage_course_id(');
    definition := replace(definition, 'public.owns_email_claim(', 'private.owns_email_claim(');
    execute definition;
  end loop;
end
$move$;

notify pgrst, 'reload schema';
