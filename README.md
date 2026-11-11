# EduHub

EduHub is a learning management system for students, instructors, and admins. Development happens in Cursor. The repository stays connected to [Lovable](https://lovable.dev/projects/cdbd28d2-04a5-4cdb-a29f-6b374732c24e); do not rewrite published git history.

The published app is [https://eduhub-foundation.vercel.app/](https://eduhub-foundation.vercel.app/). It runs as a Node.js server on Vercel. A role-by-role check of that URL was not repeated for this note.

Assessment 3 work is in the repository. Tracks that are not built are listed at the end and are not described as done.

## Documentation

- [Product](specs/product.md)
- [Architecture](specs/architecture.md) — schema and repository shape. Its note that course materials are unimplemented is out of date.
- [Assessment 3](specs/assessment-3/assessment-3.md)
- [Constitution](specs/constitution.md)
- [Coding standards](specs/coding-standards.md)
- [Supabase guide](specs/guides/supabase.md)
- [Frontend guide](specs/guides/frontend.md)
- [Agent guide](AGENTS.md)

## Development

Requires Node.js and npm. GitHub Actions uses Node.js 22.

```sh
npm ci
npm run dev
npm run lint
npx tsc --noEmit
npm test
npm run build
```

`npm run test:e2e` runs `src/test/student-happy-path.test.tsx`. That test uses an in-memory catalogue. It does not call Supabase or Gemini.

`npm test` is the full Vitest suite. CI (`.github/workflows/ci.yml`) runs lint, `tsc`, that suite, and the production build on every push and pull request. A green run on GitHub was not checked for this note.

Edge Function secrets are set with `supabase secrets set` and are not prefixed with `VITE_`. The functions read `GEMINI_API_KEY`, `OLLAMA_HOST`, `YOUTUBE_API_KEY`, `RESEND_API_KEY`, `RESEND_FROM`, `RESEND_WEBHOOK_SECRET`, `HUBSPOT_ACCESS_TOKEN`, and `SENTRY_DSN`. The browser reads `VITE_SENTRY_DSN` at build time. A missing YouTube key still returns a course preview. A missing Gemini key returns “AI is not configured.”

## Roles

| Role       | Main routes                                                                                                             |
| ---------- | ----------------------------------------------------------------------------------------------------------------------- |
| Student    | `/student/courses`, `/student/my-courses`, `/student/assistant`, assignments, grades, certificates                      |
| Instructor | `/instructor`, course builder at `/instructor/courses/generate`, materials at `/instructor/courses/$courseId/materials` |
| Admin      | `/admin/courses`, approvals at `/admin/courses/approvals`, `/admin/campaigns`                                           |

Sign-in uses the caller’s Supabase session. Queries and enrolment inserts use that JWT, so row policies apply. The service role is limited to the assignment-reminder job.

## Learning Assistant

A student opens `/student/assistant`. The page calls the `ai-agent` Edge Function. `verify_jwt` is true. Only a student continues. The model is `gemini-3.5-flash-lite`. Each Gemini call waits up to 45 seconds. The browser still sends `{ messages }` and reads `{ text, courses, enrolled }`.

One request is a supervisor and one specialist:

| Agent                | Tools                                                                                                     |
| -------------------- | --------------------------------------------------------------------------------------------------------- |
| Supervisor           | None. It chooses a specialist and a task. Confidence below 0.7 on an enrolment route does not run a tool. |
| Tutor                | `search_catalogue`, `describe_course`                                                                     |
| Advisor              | `latest_published_course`, `search_catalogue`, `suggest_next_course`, `count_published_courses`           |
| Enrolment specialist | `enrol_in_course`, `fetch_my_grades`, `describe_course`                                                   |

`enrol_in_course` still runs only when the latest message asks to enrol or join. A latest or newest published-course question is handled by the advisor. If the model calls `search_catalogue` for that question, the server runs `latest_published_course` instead. That tool reads published courses, with category name, through the student JWT, ordered by `created_at` descending. A word such as “tech” matches a category name such as Technology.

Shared memory lasts for one request. It holds the latest 8 messages (1,000 characters each), the supervisor task, tool results, and course ids returned by those tools. The transcript is not stored. Leaving the page drops it. One specialist runs per message. Study Companion on an enrolled course stays a separate `ai-study` call.

Guardrails in `supabase/functions/_shared/guardrails.ts` redact email and phone patterns, wrap untrusted text, and allow only each function’s tools. Course review requires a confidence from 0 to 1. Below 0.7 the review is stored and labelled “Low confidence”; Approve stays available. Study Companion, Course Builder, and the assistant answer do not require a confidence field.

Catalogue search embeds the query with Ollama `nomic-embed-text` at 768 dimensions and calls `match_knowledge`. `OLLAMA_HOST` is the Edge Function setting for that call. A connection failure is logged as `ollama-embed` with no query text and no host, and the student sees “The AI request failed.” Search stops when that host is unreachable. The repository does not contain the host URL.

The `ai-agent` code includes the 45-second timeout and the latest-published lookup. This note does not claim a new production deploy after that lookup was added.

## Email, CRM, and campaigns

Enrolment and certificate email go out through Resend from `student-email`. A certificate email is sent only after the course is completed. `resend-webhook` checks the Svix signature and records opened and failed events. `verify_jwt` is false only for that webhook. A saved enrolment can also upsert a HubSpot contact. Google Calendar is not integrated.

Admins build campaigns at `/admin/campaigns`. Segments are `new`, `active`, and `inactive`. The screen tracks sent, opened, bounced, and re-enrolled. Delivery uses the same email provider. A live campaign send was not repeated for this note.

## Course materials and review

Instructors attach files at `/instructor/courses/$courseId/materials`. Files live in the private `course-materials` bucket. Students see the list on a course they can open. Admins review a waiting course at `/admin/courses/approvals`. `ai-course-review` writes an advisory review. Approve is still the only publish path.

## Model comparison and RAG

The level classifier report is [docs/assessment-3/level-accuracy-comparison.md](docs/assessment-3/level-accuracy-comparison.md). Gemini and Ollama (`llama3.2`) both classified the same 40 held-out rows. Accuracy, macro precision, macro recall, and macro F1 are 1.000 for both, above the 0.85 target. No fine-tuned model is wired into the assistant.

RAG is still vector search over `rag_chunks`. The Assessment 2 report [docs/assessment-2/rag-evaluation.md](docs/assessment-2/rag-evaluation.md) scored 5,040 chunks:

| Set                           | Queries | Hit@5 | MRR@5 | Mean top-1 cosine |
| ----------------------------- | ------: | ----: | ----: | ----------------: |
| Matching                      |      30 | 1.000 | 0.950 |             0.888 |
| Noisy                         |      30 | 0.867 | 0.291 |             0.841 |
| Extreme, with an expected key |      15 | 0.133 | 0.080 |             0.820 |
| Extreme, out of corpus        |      15 |     — |     — |             0.493 |

Hybrid search, re-ranking, faithfulness, and answer relevance are not implemented. Those numbers are the Assessment 2 baseline, not a new side-by-side.

## CI, Sentry, and rate limits

CI is the workflow above. Sentry is initialized for the browser (`@sentry/react`), the Vercel server (`@sentry/node`), and Edge Functions (`@sentry/deno`) only when the matching DSN is set. Events omit prompts, cookies, headers, and request bodies. Sending was not rechecked for this note.

`supabase/migrations/20261109010000_ai_request_limits.sql` adds hourly limits: study 30, assistant 20, course builder 10, and course review 10. The handlers call `consume_ai_request`. Generated `types.ts` does not list that RPC, so this note does not claim the migration is applied. Until it is, a deployed function that calls it fails closed and does not call Gemini.

## Assignment reminders

`POST /api/assignment-reminders` runs on the app server. It accepts POST only, with a bearer that matches `LOVABLE_CRON_SECRET` or `LOVABLE_CRON_SECRET_PREVIOUS`. The server also needs `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Do not prefix those with `VITE_` and do not commit them.

Schedule one POST every hour, cron `0 * * * *` UTC:

```sh
curl -X POST "https://<published-origin>/api/assignment-reminders" \
  -H "Authorization: Bearer <LOVABLE_CRON_SECRET>"
```

A matching bearer returns `{"ok":true,"inserted":<number>}`. A missing or wrong bearer returns 401. An authorized GET returns 405. A second run does not insert a duplicate for the same assignment, student, stage, and due date.

Course completion still writes `lesson_completions`, sets the enrolment completed, and issues one certificate plus notifications. The hourly reminder schedule was confirmed earlier. The workflow tests use an in-memory store.

## Not finished for Assessment 3

- Google Calendar.
- A stored transcript or memory that survives a refresh.
- Hybrid RAG, re-ranking, faithfulness, answer relevance, and a labelled agent task-success eval.
- A fine-tuned model in the assistant.
- An `assessment-3` git tag, a GitHub Release, a demo, and a Dev Control Tower filing. The `assessment-2` tag is the only assessment tag in this clone. Dev Control Tower was not filed for Assessment 2 either.
