-- Keyword search beside match_knowledge. No new table or column.
-- security invoker, so the rag_chunks select policy still applies.

create or replace function public.search_knowledge_text(
  query_text text,
  match_count integer
)
returns table (
  id uuid,
  source_type text,
  title text,
  body text,
  course_id uuid,
  similarity double precision
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if query_text is null or pg_catalog.btrim(query_text) = '' then
    return;
  end if;

  return query
  select
    chunk.id,
    chunk.source_type,
    chunk.title,
    chunk.body,
    chunk.course_id,
    pg_catalog.ts_rank_cd(
      pg_catalog.to_tsvector(
        'english',
        pg_catalog.concat_ws(' ', chunk.title, chunk.body)
      ),
      pg_catalog.websearch_to_tsquery('english', query_text)
    )::double precision as similarity
  from public.rag_chunks as chunk
  where chunk.embedding is not null
    and pg_catalog.to_tsvector(
      'english',
      pg_catalog.concat_ws(' ', chunk.title, chunk.body)
    ) @@ pg_catalog.websearch_to_tsquery('english', query_text)
  order by 6 desc, chunk.id
  limit least(greatest(coalesce(match_count, 0), 0), 10);
end;
$$;

revoke all on function public.search_knowledge_text(text, integer) from public, anon;
grant execute on function public.search_knowledge_text(text, integer) to authenticated;

notify pgrst, 'reload schema';
