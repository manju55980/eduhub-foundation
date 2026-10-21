# RAG corpus

Specifies the persistent course, lesson, and FAQ text used to ground later learner questions. Study Companion stays in `student-ai-study-companion.md` and still answers from the one enrolled course passed in its prompt. This feature does not replace that function and does not add a chat screen. Roles stay in `product.md`. Columns and the planned migration stay in `architecture.md`.

This feature adds `rag_chunks` and `match_knowledge`. The migration `supabase/migrations/20261016222000_rag_chunks.sql` is applied on the linked project. The seed script is `scripts/seed-rag-chunks.ts`. It reads `GEMINI_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` from the environment and does not print them. `RAG_EMBED_BATCH_SIZE` (default 8, maximum 32), `RAG_EMBED_DELAY_MS` (default 1000), and `RAG_EMBED_MAX_ATTEMPTS` (default 4) control each embedding batch. A 429 that names the plan or billing quota stops immediately. A rate-limit 429 or a 5xx response retries with bounded backoff. Rows already stored are left in place, and unchanged text is not embedded again. Course and lesson chunks are embedded before FAQ rows. Unchanged `source_key` values are skipped. `RAG_EMBED_RECORD_LIMIT` defaults to 300, and a quota error stops without retry. The 19 October resumes kept earlier rows, embedded 96 and then 176 more, and both stopped on the plan quota. A 21 October resume kept those 572 rows, embedded 104 more (2 course, 12 lesson, and 90 FAQ), and stopped on the plan quota. `rag_chunks` then held 676 rows: 8 course, 25 lesson, and 643 FAQ. The 5,000 FAQ requirement is not met. See `assessment-2-gap.md`.

## What is stored

Each chunk is one row:

| `source_type` | `source_key` | Text |
| ------------- | ------------ | ---- |
| `course` | `course:{course_id}` | That course’s `title` and `description`. |
| `lesson` | `lesson:{lesson_id}` | That lesson’s `title` and `content`. |
| `faq` | `faq:{four-digit sequence}` | A learning FAQ question and answer. |

`source_key` is unique. A seed run upserts on that key and does not create a second row. FAQ rows leave `course_id` and `lesson_id` null. Course rows set `course_id`. Lesson rows set `course_id` and `lesson_id`.

`body` is required. `embedding` is `vector(768)` and stays null until the embedding call succeeds. A row counts toward the 5,000-record bar only when `embedding` is not null. The seed must leave at least 5,000 FAQ rows embedded. Course and lesson chunks are additional. They are rebuilt when that course title, description, lesson title, or lesson content changes. A lesson edit does not change `lesson_completions`.

The embedding model is `gemini-embedding-001`, called at `models/gemini-embedding-001:embedContent`. `text-embedding-004` was shut down on 14 January 2026. The request sets `outputDimensionality` to `768`. The API default is 3072, and a 3072-dimension vector must not be stored. For this model, a size other than 3072 is not normalized by the API. Divide the returned vector by its L2 norm before insert and before a query, so the stored length is 1. Skip a zero vector. Course, lesson, and FAQ chunks use task type `RETRIEVAL_DOCUMENT`. Search and evaluation queries use `RETRIEVAL_QUERY`.

The column, the HNSW index, and `match_knowledge` all use `vector(768)` and cosine distance (`vector_cosine_ops`). A query embedding uses the same model, 768 dimensions, and L2 normalization, with task type `RETRIEVAL_QUERY`. The API key is the existing Edge Function secret `GEMINI_API_KEY`. Do not put it in a `VITE_` variable and do not send it to the browser.

## Who can read a chunk

`match_knowledge(query_embedding vector(768), match_count integer)` is security invoker. It returns `id`, `source_type`, `title`, `body`, `course_id`, and the cosine similarity, ordered by similarity, at most 10 rows. A larger `match_count` still stops at 10. Rows with a null embedding are excluded. Execute is granted to `authenticated` only.

Select policies match the text those roles can already read. They do not widen lesson visibility.

| Role | Rows |
| ---- | ---- |
| Admin | Every chunk. |
| Instructor | FAQ chunks, plus course and lesson chunks whose course `is_course_owner` accepts. |
| Student | FAQ chunks, course chunks for a `published` course or a course `is_enrolled` accepts, and lesson chunks only when `is_enrolled` accepts that course. |

A student who has not enrolled does not receive lesson body text, including through `match_knowledge`. Draft and pending course chunks are not returned to a student. Published course title and description remain readable, which `courses_select` already allows.

There is no insert, update, or delete grant for `authenticated`. The seed and the reindex use the service-role client outside the browser. They write chunks only. They do not write enrollments, grades, or submissions.

## Seed

The seed is an idempotent script, run with the service-role client. It is not a screen and not a browser request. FAQ text is generated for this corpus and stored in `rag_chunks`. Re-running the script updates the same `source_key` values. The script does not print the service-role key or `GEMINI_API_KEY`.

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
- `match_knowledge` returns at most 10 rows, skips null embeddings, and uses the caller’s RLS.
- A student who is not enrolled cannot retrieve a draft course chunk or any lesson chunk for a course they have not joined.
- The browser cannot insert a chunk and cannot read the Gemini or service-role secret.
- Existing policies on `courses` and `lessons` are unchanged.
