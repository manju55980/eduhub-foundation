-- Local until applied. Stores course, lesson, and FAQ chunks for retrieval.
-- Embeddings are vector(768). The seed and the embedding calls are not in this file.
-- match_knowledge is security invoker, so the select policy still applies.
-- Does not change course or lesson policies. Does not use the service role.

create extension if not exists vector with schema extensions;

create table public.rag_chunks (
  id uuid primary key default gen_random_uuid(),
  source_type text not null check (source_type in ('course', 'lesson', 'faq')),
  source_key text not null,
  course_id uuid references public.courses (id) on delete restrict,
  lesson_id uuid references public.lessons (id) on delete restrict,
  title text,
  body text not null,
  embedding extensions.vector(768),
  created_at timestamptz not null default now(),
  constraint rag_chunks_source_shape check (
    (
      source_type = 'faq'
      and course_id is null
      and lesson_id is null
    )
    or (
      source_type = 'course'
      and course_id is not null
      and lesson_id is null
    )
    or (
      source_type = 'lesson'
      and course_id is not null
      and lesson_id is not null
    )
  )
);

create unique index rag_chunks_source_key_uidx
  on public.rag_chunks (source_key);

create index rag_chunks_course_id_idx
  on public.rag_chunks (course_id);

create index rag_chunks_embedding_hnsw_idx
  on public.rag_chunks
  using hnsw (embedding extensions.vector_cosine_ops);

alter table public.rag_chunks enable row level security;

revoke all on table public.rag_chunks from anon, authenticated;

grant select on table public.rag_chunks to authenticated;

create policy rag_chunks_select
  on public.rag_chunks
  for select
  to authenticated
  using (
    public.current_app_role() = 'admin'
    or (
      public.current_app_role() = 'instructor'
      and (
        source_type = 'faq'
        or public.is_course_owner(course_id)
      )
    )
    or (
      public.current_app_role() = 'student'
      and (
        source_type = 'faq'
        or (
          source_type = 'course'
          and (
            public.is_published_course(course_id)
            or public.is_enrolled(course_id)
          )
        )
        or (
          source_type = 'lesson'
          and public.is_enrolled(course_id)
        )
      )
    )
  );

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
language sql
stable
security invoker
set search_path = public, extensions
as $$
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
$$;

revoke all on function public.match_knowledge(extensions.vector, integer) from public, anon;
grant execute on function public.match_knowledge(extensions.vector, integer) to authenticated;
