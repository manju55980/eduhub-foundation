-- Exact cosine order for match_knowledge. The HNSW index stays.
-- An approximate index scan returned more distant FAQ rows ahead of a nearer course chunk.
-- Does not change rag_chunks rows or embeddings.

create or replace function public.match_knowledge(
  query_embedding extensions.vector(768),
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
set search_path = public, extensions
as $$
begin
  perform set_config('enable_indexscan', 'off', true);
  perform set_config('enable_bitmapscan', 'off', true);
  return query
  select
    chunk.id,
    chunk.source_type,
    chunk.title,
    chunk.body,
    chunk.course_id,
    1 - (chunk.embedding <=> query_embedding) as similarity
  from public.rag_chunks as chunk
  where chunk.embedding is not null
  order by chunk.embedding <=> query_embedding
  limit least(greatest(coalesce(match_count, 0), 0), 10);
end;
$$;

revoke all on function public.match_knowledge(extensions.vector, integer) from public, anon;
grant execute on function public.match_knowledge(extensions.vector, integer) to authenticated;
