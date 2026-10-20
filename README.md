# EduHub

EduHub is a small learning management system for the SJ Innovation Week 1 assignment. Development happens in Cursor. The repository stays connected to [Lovable](https://lovable.dev/projects/cdbd28d2-04a5-4cdb-a29f-6b374732c24e); do not rewrite published git history.

## Documentation

- [Assignment requirements](specs/EduHub_Assignment1_Requirements.md) — assignment source of truth
- [Constitution](specs/constitution.md) — engineering principles
- [Product](specs/product.md) — what to build, and what is still unresolved
- [Architecture](specs/architecture.md) — current repository shape and schema
- [Coding standards](specs/coding-standards.md)
- [Supabase guide](specs/guides/supabase.md)
- [Frontend guide](specs/guides/frontend.md)
- [Agent guide](AGENTS.md)

## Development

Requires Node.js and npm.

```sh
npm i
npm run dev
```

```sh
npm run lint
npm test
npm run build
```

The Assessment 2 student happy path runs on its own with:

```sh
npm run test:e2e
```

That command runs `src/test/student-happy-path.test.tsx`. The test seeds an in-memory catalogue and clears those rows when it finishes. It does not call Supabase or Gemini.

## Assessment 2

### Learning assistant

A student opens Learning Assistant at `/student/assistant`. The `ai-agent` Edge Function calls `gemini-3.5-flash-lite` with that student’s session. It can search the catalogue, describe a visible course, enrol the signed-in student in a published course, read that student’s grades, and suggest a next course. Row policies still hide draft courses and lesson text for a course the student has not joined. The chat transcript is not stored.

### Workflows

Course completion is the first workflow. Marking each enrolled lesson complete inserts `lesson_completions`. When every lesson is complete, enrollment progress becomes 100, the status trigger sets `completed`, and `enrollments_issue_certificate` inserts one certificate plus one notification for the student and one for the instructor.

Assignment reminders are the second workflow. `POST /api/assignment-reminders` inserts `assignment_due` notifications for assignments due within 72 hours when the student has not submitted. The hourly caller is documented below. That route has not been run against the database.

### RAG

Course, lesson, and FAQ text is stored in `rag_chunks`. Embeddings use `gemini-embedding-001` at 768 dimensions. `match_knowledge` ranks rows by cosine similarity and runs as the signed-in student, so the select policy applies. The database now has 572 embedded chunks: 6 course, 13 lesson, and 553 FAQ. A later 19 October seed kept 396 unchanged rows, wrote 176 more FAQ rows, and stopped again on the Gemini plan quota. The scored report still covers the earlier 300-chunk run and was not re-run. The 5,000 FAQ record requirement is not met.

The retrieval report is [docs/assessment-2/rag-evaluation.md](docs/assessment-2/rag-evaluation.md):

| Set | Queries | Hit@5 | MRR@5 | Mean top-1 cosine |
| --- | ---: | ---: | ---: | ---: |
| Matching | 30 | 1.000 | 1.000 | 0.844 |
| Noisy | 30 | 1.000 | 1.000 | 0.807 |
| Extreme, with an expected key | 15 | 1.000 | 0.649 | 0.738 |
| Extreme, out of corpus | 15 | — | — | 0.537 |

Extreme rejection at cosine 0.75 is 1.000: all 15 out-of-corpus queries had a top row below 0.75. That figure is not Hit@5. Noise delta (matching Hit@5 minus noisy Hit@5) is 0.000.

### Level accuracy

`scripts/level-accuracy.ts` predicts `beginner`, `intermediate`, or `advanced` with `gemini-3.5-flash-lite`. The labelled file uses a seed-42 split of 160 train rows and 40 test rows. The evidence is [docs/assessment-2/level-accuracy.md](docs/assessment-2/level-accuracy.md).

On 19 October 2026 the script resumed 16 saved predictions, then Gemini returned a plan quota error and stopped. Those 16 predictions are unchanged. Accuracy on the classified rows is 1.000. Coverage is 0.400. One call is an infrastructure error, and 23 held-out rows were not called. The 0.70 target is not met, because the classified count is not the full test count. The confusion matrix is 4 beginner, 8 intermediate, and 4 advanced, all on the diagonal.

### Submission checklist

| Item | Where it stands |
| --- | --- |
| Agent, both workflows, RAG design, and test commands | This section |
| Retrieval quality | [docs/assessment-2/rag-evaluation.md](docs/assessment-2/rag-evaluation.md), scored on 300 chunks; 572 chunks are now stored |
| Accuracy evidence and model | [docs/assessment-2/level-accuracy.md](docs/assessment-2/level-accuracy.md), `gemini-3.5-flash-lite`, partial coverage |
| Unit and happy-path commands | `npm test` and `npm run test:e2e` |
| Live URL | `https://eduhub-foundation.vercel.app/` returned HTTP 200 on 19 October 2026. The page title is the EduHub landing title. Role-by-role checks on that URL were not run. |
| `assessment-2` git tag | Not created. |
| Role login credentials | Not stored in this repository. |
| Dev Control Tower submission | Not filed. |
| Full unit-test output | Not captured in this pass. `npm run test:e2e` passed 1 test earlier. |

## Assignment reminders

`POST /api/assignment-reminders` is the only reminder job. It runs on the published app server, not as a Supabase Edge Function and not from the browser. The published Lovable worker does not provide a repository schedule that can POST this path, and Vercel Cron sends GET with `CRON_SECRET`. This route accepts POST only, and only a bearer that matches `LOVABLE_CRON_SECRET` or `LOVABLE_CRON_SECRET_PREVIOUS`.

After the app is published, set these on that server runtime. Do not prefix them with `VITE_`, and do not commit the values.

- `LOVABLE_CRON_SECRET` — random bearer for the scheduler. A missing value makes the route return 500 and insert nothing.
- `LOVABLE_CRON_SECRET_PREVIOUS` — optional, only while rotating the bearer.
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` — required by the service-role client that inserts `assignment_due` rows.

Then schedule one POST every hour, cron `0 * * * *` UTC, so a due date inside the 72-hour window is not missed:

```sh
curl -X POST "https://<published-origin>/api/assignment-reminders" \
  -H "Authorization: Bearer <LOVABLE_CRON_SECRET>"
```

A matching bearer returns `{"ok":true,"inserted":<number>}`. A missing or wrong bearer returns 401. An authorized GET returns 405. A second run does not insert a duplicate for the same assignment, student, and due date. Do not add a second job that inserts `assignment_due` itself.
