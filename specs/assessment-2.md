# SJ Innovation Assessment 2 (continuation of Assessment 1)

## EduHub — Level 2: make it AI-powered and tested

Learning Management System. Take the Assessment 1 build to a production-minded, AI-driven app.

## What you built in Assessment 1

A working LMS with Student, Instructor, and Admin roles: instructors create courses (admin-published), students enrol and submit assignments, and instructors grade them. Deployed with Supabase and row-level security.

## Assessment 2 in one line

Keep the same app, and add an AI agent, 2 automations, a RAG system on 5,000+ records, a real LLM integration with a ≥70% accuracy result, and automated tests — all with great UI/UX.

## Your seven tracks

### 1. AI Agent — add new or enhance existing — 20 pts

- **Option A (new):** A learning assistant that recommends courses to a student and answers “what does this course / lesson cover” from the catalogue.
- **Option B (enhance):** Upgrade it to an agent with tools that can enrol a student, fetch their grades, and suggest the next course by calling your own functions.

Do at least one well. Use Gemini (free) or Ollama for the model.

### 2. Two new workflows / automations — 15 pts

- **Assignment and deadline reminders:** automatically remind enrolled students of upcoming assignment due dates.
- **Completion automation:** when a student finishes all lessons, auto-mark the course complete and issue a certificate (or notify the instructor).

“Workflow/automation” means something that runs on an event or schedule without a user clicking through every step.

### 3. RAG on ≥5,000 records — 20 pts

Course content, lessons, and a learning FAQ. Seed ≥5,000 records. Answer learner questions grounded in this data.

Evaluate three query sets and report results:

1. **Matching**
2. **Extreme / edge**
3. **Noisy** (typos and junk)

Report retrieval quality with versus without noise.

### 4. LLM integration + train and show ≥70% accuracy — 15 pts

Wire in a free LLM (Gemini key, or Ollama locally). Then the classification task:

Predict a course’s category or level (beginner / intermediate / advanced) from its title and description. Report ≥70% accuracy.

Split train/test, report accuracy on the held-out set, and include the number as evidence.

### 5. Test automation for all modules — 15 pts

Add unit tests for every module (auth, each role’s core actions, the workflows, and the RAG/agent layer) and at least one end-to-end happy-path test. Tests run with one command and pass.

### 6. Best-possible UI/UX — 10 pts

Polish the whole experience: loading, empty, and error states, responsive layout, a clean agent chat UI, and clear feedback when automations fire.

### 7. Docs and Dev Control Tower submission — 5 pts

Update the README, record your RAG and accuracy metrics, and submit everything on Dev Control Tower.

### Stretch / bonus

Have the assistant draft lesson feedback or a short quiz from a lesson’s content for the instructor to review.

Scored bonus (see scoring): Ollama local model; agent takes real multi-step actions. **+10**.

## Tooling and how-to (free options)

### LLM and API keys (free)

- **Google Gemini** — free key at [aistudio.google.com](https://aistudio.google.com). The assignment names `gemini-1.5-flash` for chat and `text-embedding-004` for embeddings. This repository keeps chat on `gemini-3.5-flash-lite`. Embeddings use local Ollama `nomic-embed-text` at 768 dimensions. See `features/student/student-rag-corpus.md`.
- **Ollama** (local, optional, encouraged) — [ollama.com](https://ollama.com). Run `llama3.2` / `phi3` and `nomic-embed-text` for embeddings.
- Never commit API keys. Keep them in environment variables or Supabase secrets.

### RAG stack

- Store embeddings in Supabase `pgvector` (enable the vector extension) or a local store (Chroma / FAISS).
- Pipeline: chunk → embed → store → retrieve top-k by cosine similarity → feed to the LLM as context.

### The “train and show ≥70% accuracy” task

Take a labelled slice of the seed data, split train/test (80/20), build a simple classifier (LLM few-shot, or scikit-learn on embeddings), and report accuracy on the held-out set. Target ≥70% with a metrics or confusion-matrix screenshot.

### Generating 5,000+ seed records and the 3 query sets

Use a script (Faker or an LLM) to generate ≥5,000 realistic records. Make 3 query sets for RAG:

1. Matching
2. Extreme / edge
3. Noisy (typos and junk)

Report retrieval quality with and without noise.

## How you will be scored

Scored on the same Assessment 2 parameter sheet as the rest of the team. Build against each parameter.

| Parameter | Max |
| --- | ---: |
| AI agent — new or meaningfully enhanced (tool-calling) | 20 |
| Two new workflows / automations, end-to-end | 15 |
| RAG on ≥5,000 records — matching + extreme + noise, quality reported | 20 |
| LLM integration + train and show ≥70% accuracy with evidence | 15 |
| Test automation — unit tests for all modules + E2E happy path | 15 |
| Best-possible UI/UX | 10 |
| Docs, metrics, and Dev Control Tower submission | 5 |
| **Total** | **100** |
| Bonus — Ollama local model; agent takes real multi-step actions | +10 |

## Evaluation criteria

### RAG evaluation

- Seed at least 5,000 records covering course content, lessons, and a learning FAQ.
- Answers must be grounded in that data.
- Evaluate and report three query sets: matching, extreme/edge, and noisy (typos and junk).
- Report retrieval quality with noise and without noise (table or screenshot).

### Accuracy evaluation

- Classification target: predict a course’s category or level (beginner / intermediate / advanced) from title and description.
- Split labelled seed data train/test 80/20.
- Classifier may be LLM few-shot or scikit-learn on embeddings.
- Report accuracy on the held-out set. Target ≥70%.
- Evidence: the accuracy number, the LLM or model used, and a metrics or confusion-matrix screenshot.

### Test evaluation

- Unit tests for every module: auth, each role’s core actions, the workflows, and the RAG/agent layer.
- At least one end-to-end happy-path test.
- Tests run with one command and pass. Submit the test-run output.

### UI/UX evaluation

- Loading, empty, and error states.
- Responsive layout.
- A clean agent chat UI.
- Clear feedback when automations fire.

## What to submit on Dev Control Tower

1. Updated live URL (Vercel) and GitHub repo (tag an `assessment-2` release).
2. A short README / demo notes: the agent, the 2 workflows, the RAG design, and how to run the tests.
3. RAG evaluation — retrieval quality with versus without noise (table or screenshot).
4. Accuracy evidence — the ≥70% result and which LLM/model you used.
5. Test run output — unit tests passing and at least one E2E happy-path.
6. Updated test credentials for each role.

## Decisions recorded for this repository

These decisions apply the tracks below to the current EduHub schema. They do not replace the scoring or submission list.

- Course completion is lesson-based. A student marks each enrolled lesson complete. `enrollments.progress` becomes 100 only when every lesson in that course is complete, and the existing status trigger then sets `completed`. See `features/student/student-lesson-completion.md`.
- The first completion issues one certificate and in-app notifications to the student and the owning instructor. Upcoming assignment reminders are in-app notifications, not email. See `features/student/student-certificates-and-notifications.md`.
- RAG data persists in `rag_chunks` with `pgvector`. The corpus is course text, lesson text, and at least 5,000 embedded FAQ rows. Draft and unenrolled lesson text stays behind the existing lesson visibility rules. See `features/student/student-rag-corpus.md`.
- The learning assistant is a student chat on `/student/assistant`. It recommends and describes catalogue courses from tool results, and it can enrol the signed-in student, read that student’s grades, and suggest a next course. See `features/student/student-learning-assistant.md`.
- Level classification uses an 80/20 split of a labelled file, seed 42, and reports held-out accuracy for `gemini-3.5-flash-lite`. It does not change stored course levels. See `features/student/student-level-accuracy.md`.
- RAG evaluation reports Hit@5, MRR@5, mean top-1 cosine, extreme rejection, and the matching-versus-noisy delta. See `features/student/student-rag-evaluation.md`.

The schema and the ordered implementation tasks are in `architecture.md`. Current status, including what is blocked, is in `assessment-2-gap.md`. RAG stores 5,040 embedded chunks, including 5,000 FAQ rows, and the retrieval report scores that corpus. Deployed catalogue search depends on a temporary Cloudflare tunnel to local Ollama. `supabase/migrations/20261027004700_match_knowledge_exact_search.sql` was applied manually, so `match_knowledge` sorts stored vectors exactly. Catalogue search was not repeated after that apply. The level classifier is partially completed: 32 of 40 held-out rows are classified. The classifier stays paused on the Gemini plan quota. The learning-assistant browser pass recorded there was not repeated after the embedding change. `ai-agent` is deployed. The signed-in student layout was checked at 390px and 320px. Instructor and admin dashboards were opened at those widths in headless Edge, with no document overflow. The other instructor and admin routes were not held in that session. Both automations work, and the hourly reminder schedule is confirmed. The `assessment-2` tag is pushed and points at an older commit than this corpus. Role credentials and the Dev Control Tower submission are still incomplete. `npm run test:e2e` passed 1 Vitest/jsdom test. That run does not verify live Supabase or a real browser.

## Golden rule

Finish and polish what works before chasing bonus points. A clean, tested, AI-powered app beats a pile of half-features.
