# RAG corpus

Specifies the persistent course, lesson, and FAQ text used to ground later learner questions. Study Companion stays in `student-ai-study-companion.md` and still answers from the one enrolled course passed in its prompt. This feature does not replace that function and does not add a chat screen. Roles stay in `product.md`. Columns and the planned migration stay in `architecture.md`.

This feature adds `rag_chunks` and `match_knowledge`. The migration `supabase/migrations/20261016222000_rag_chunks.sql` is applied on the linked project. The seed script is `scripts/seed-rag-chunks.ts`. It reads `SUPABASE_SERVICE_ROLE_KEY` and `OLLAMA_HOST` from the environment and does not print them. `OLLAMA_HOST` defaults to `http://127.0.0.1:11434`. `RAG_EMBED_BATCH_SIZE` (default 8, maximum 32), `RAG_EMBED_DELAY_MS` (default 1000), and `RAG_EMBED_MAX_ATTEMPTS` (default 4) control each embedding batch. A rate-limit response or a 5xx response retries with bounded backoff. A 400 from Ollama is retried the same way. Rows already stored are left in place. Unchanged text is not embedded again unless `RAG_EMBED_REPLACE_ALL` is `true`, which upserts every chunk so a model change can replace vectors without deleting rows. `RAG_EMBED_WRITE=false` fills the local cache and does not upsert. Course and lesson chunks are written before FAQ rows. `RAG_EMBED_RECORD_LIMIT` defaults to 300. Earlier Gemini resumes stopped on the plan quota at 676 rows. On 26 October 2026 a replace run upserted the cached Nomic vectors in place. `rag_chunks` now holds 5,040 embedded rows: 9 course, 31 lesson, and 5,000 FAQ. The 5,000 FAQ requirement is met. See `assessment-2-gap.md`.

## What is stored

Each chunk is one row:

| `source_type` | `source_key` | Text |
| ------------- | ------------ | ---- |
| `course` | `course:{course_id}` | That course’s `title` and `description`. |
| `lesson` | `lesson:{lesson_id}` | That lesson’s `title` and `content`. |
| `faq` | `faq:{four-digit sequence}` | A learning FAQ question and answer. |

`source_key` is unique. A seed run upserts on that key and does not create a second row. FAQ rows leave `course_id` and `lesson_id` null. Course rows set `course_id`. Lesson rows set `course_id` and `lesson_id`.

`body` is required. `embedding` is `vector(768)` and stays null until the embedding call succeeds. A row counts toward the 5,000-record bar only when `embedding` is not null. The seed must leave at least 5,000 FAQ rows embedded. Course and lesson chunks are additional. They are rebuilt when that course title, description, lesson title, or lesson content changes. A lesson edit does not change `lesson_completions`.

The embedding model is Ollama `nomic-embed-text`, called at `POST /api/embed`. Document text is prefixed with `search_document:` and query text with `search_query:`. The vector is 768 dimensions. Divide it by its L2 norm before insert and before a query, so the stored length is 1. Skip a zero vector. Successful vectors are appended to `scripts/fixtures/rag-embeddings.jsonl`, which is gitignored. Each line stores `source_key`, the SHA-256 of `body`, and the normalized vector. A later run reuses a line when the key and body hash match and does not call Ollama again. Chat stays on `gemini-3.5-flash-lite`.

The column and the HNSW index use `vector(768)` and cosine distance (`vector_cosine_ops`). `match_knowledge` sorts those stored vectors by exact cosine distance and turns index scans off for that call, so the HNSW index does not choose the rows. A query embedding uses the same model, the same 768 dimensions, the same L2 normalization, and the `search_query:` prefix. `ai-agent` reads `OLLAMA_HOST`. Do not put that host in a `VITE_` variable. The deployed function cannot use `localhost`. On 26 October 2026 `OLLAMA_HOST` was an account-less Cloudflare quick tunnel to a local proxy that accepts only `POST /api/embed` for `nomic-embed-text`. The tunnel URL is not stored in this repository. Cloudflare does not guarantee it. If Ollama, the proxy, or the tunnel stops, `search_catalogue` cannot embed a query.

## Who can read a chunk

`match_knowledge(query_embedding vector(768), match_count integer)` is security invoker. It returns `id`, `source_type`, `title`, `body`, `course_id`, and the cosine similarity. The order is an exact sort of the stored vectors, at most 10 rows. A larger `match_count` still stops at 10. Rows with a null embedding are excluded. Execute is granted to `authenticated` only. The migration `supabase/migrations/20261027004700_match_knowledge_exact_search.sql` replaces the function. It does not change chunk rows or embeddings. It was applied manually on the linked database. Catalogue search was not repeated after that apply.

Select policies match the text those roles can already read. They do not widen lesson visibility.

| Role | Rows |
| ---- | ---- |
| Admin | Every chunk. |
| Instructor | FAQ chunks, plus course and lesson chunks whose course `is_course_owner` accepts. |
| Student | FAQ chunks, course chunks for a `published` course or a course `is_enrolled` accepts, and lesson chunks only when `is_enrolled` accepts that course. |

A student who has not enrolled does not receive lesson body text, including through `match_knowledge`. Draft and pending course chunks are not returned to a student. Published course title and description remain readable, which `courses_select` already allows.

There is no insert, update, or delete grant for `authenticated`. The seed and the reindex use the service-role client outside the browser. They write chunks only. They do not write enrollments, grades, or submissions.

## Seed

The seed is an idempotent script, run with the service-role client. It is not a screen and not a browser request. FAQ text is generated for this corpus and stored in `rag_chunks`. Re-running the script updates the same `source_key` values. The script does not print the service-role key or `OLLAMA_HOST`.

Retrieval quality is specified in `student-rag-evaluation.md`. It is not part of this migration.

## Out of scope

- Replacing `ai-study` or `ai-course-builder`.
- A chat UI and tool calls. Those are specified in `student-learning-assistant.md`.
- The level or category classifier and its accuracy report. The level report is specified in `student-level-accuracy.md`.
- Storing study answers, practice questions, grades, or submissions in `rag_chunks`.

## Acceptance criteria

- `rag_chunks` persists in Postgres with the `vector` extension and an HNSW cosine index.
- At least 5,000 FAQ rows have a non-null 768-dimension embedding. A second seed run does not duplicate `source_key`.
- Course and lesson chunks exist for stored course and lesson text and are updated when that text changes.
- `match_knowledge` returns at most 10 rows in exact cosine order, skips null embeddings, does not use the HNSW index scan, and uses the caller’s RLS.
- A student who is not enrolled cannot retrieve a draft course chunk or any lesson chunk for a course they have not joined.
- The browser cannot insert a chunk and cannot read the Gemini or service-role secret.
- Existing policies on `courses` and `lessons` are unchanged.
