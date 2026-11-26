# SJ Innovation Assessment 4 (continuation of Assessments 1–3)

## EduHub — adaptive tutor

Learning Management System. A tutor that plans, retrieves, grades, and adjusts difficulty, with evaluation that can fail a build.

Extracted from `assessment-4.pdf`. The source PDF is titled “Assessment 3 — EduHub: Multi-Agent Tutor & Adaptive Learning” and calls itself a next-level challenge that continues Assessment 2. This repository already has a different Assessment 3 brief, issued 27 October 2026, in `assessment-3/assessment-3.md`. This file records the attached brief as Assessment 4 so the two briefs stay separate.

|                |                                                                                                      |
| -------------- | ---------------------------------------------------------------------------------------------------- |
| Intern         | Manju Ayalli                                                                                         |
| Project        | EduHub                                                                                               |
| Continues from | The live EduHub app. The PDF says Assessment 2. This repo also has the Assessment 3 work.            |
| Assigned       | Blank on the PDF                                                                                     |
| Due            | One week from assignment. The PDF leaves the calendar date blank. Late work is accepted and flagged. |
| Score          | 110, plus two bonuses of 5                                                                           |

The PDF says the assigned and due dates in words and then leaves the date fields empty. Do not invent those dates.

## Where the app is now

The course tutor, hybrid retrieval, the next-question difficulty change, and the eval gate have feature specs and application code. The completion webhook stays unimplemented. The status section at the end of this file is the current list.

The app already has these pieces:

- The learning assistant is one `ai-agent` request: a supervisor, then a tutor, an advisor, or an enrolment specialist. The course tutor is a card on the enrolled course: a planner, a retriever, and a grader. It does not replace those three specialists.
- Catalogue search and the course tutor merge vector search with English full-text search. The side-by-side scores are in `docs/assessment-4/hybrid-rag.md`.
- The level classifier scores beginner, intermediate, and advanced offline. Gemini and Ollama `llama3.2` each reached macro F1 1.000 on all 40 held-out rows. The next tutor question is harder after a supported answer and easier after a partial or unsupported answer. The classifier does not write `courses.level`.
- Resend sends enrolment and certificate mail. `resend-webhook` checks the Svix signature and records opened and failed events. HubSpot can upsert a contact. That webhook is an email delivery webhook, not a course-completion call into a CRM.
- GitHub Actions runs lint, TypeScript, Vitest, `scripts/eval-gate.ts`, and the production build. The gate reads the saved reports. Sentry is initialized only when a DSN is set. Hourly AI limits are in `supabase/migrations/20261109010000_ai_request_limits.sql`. Generated `types.ts` does not list `consume_ai_request`, so this note does not claim that migration is applied.

## Assessment 4 in one line

Make EduHub adaptive and measurable: a supervisor over a planner, a retriever, and a grader; hybrid RAG with a RAGAS-style harness against the Assessment 2 baseline; a live difficulty adaptation; one verified inbound webhook; and a CI gate that fails when faithfulness or classifier F1 drops below a threshold.

If a concept cannot be finished, record the cut in the Decision Log. A finished concept with evidence outranks a half-built one.

## The five required concepts

### 1. Multi-agent tutor — 25 pts

A supervisor over at least two agents. This brief names three:

| Agent     | Job                                               |
| --------- | ------------------------------------------------- |
| Planner   | Builds the learning path                          |
| Retriever | Retrieves course, lesson, and FAQ context         |
| Grader    | Evaluates the learner’s answer and gives feedback |

Guardrails:

- The grader does not invent a grade without evidence.
- Learner data is redacted for PII before it is sent on.
- Low confidence is refused.
- Outputs are structured.

Evidence: a trace of one question through plan, retrieved context, and graded feedback.

This does not replace the current tutor, advisor, and enrolment specialist until that change is asked for. Those three remain the Assessment 3 assistant.

### 2. Hybrid RAG and a RAGAS-style harness — 20 pts

Keep a corpus of at least 5,000 records. Add hybrid retrieval and re-ranking. Measure faithfulness, answer relevance, and context precision, and put those numbers beside the Assessment 2 baseline.

The Assessment 2 baseline, from `docs/assessment-2/rag-evaluation.md`:

| Set                           | Queries | Hit@5 | MRR@5 | Mean top-1 cosine |
| ----------------------------- | ------: | ----: | ----: | ----------------: |
| Matching                      |      30 | 1.000 | 0.950 |             0.888 |
| Noisy                         |      30 | 0.867 | 0.291 |             0.841 |
| Extreme, with an expected key |      15 | 0.133 | 0.080 |             0.820 |
| Extreme, out of corpus        |      15 |     — |     — |             0.493 |

Evidence: a metrics table, baseline versus the new run. The harness must be repeatable. The new run is `docs/assessment-4/hybrid-rag.md`. The three extra scores are lexical stand-ins, not a model judge.

### 3. Adaptive difficulty — 15 pts

Take the beginner / intermediate / advanced classifier to macro F1 of at least 0.80 on the full held-out set, with every row classified. Wire it so the app changes content difficulty for the learner. Show before and after.

The offline comparison already clears 0.80: both providers scored F1 1.000 on 40 of 40 rows in `docs/assessment-3/level-accuracy-comparison.md`. The live change is the next tutor question. A supported answer makes the next question harder. A partial or unsupported answer makes it easier. The first question stays a starting question. `courses.level` and the lessons are not rewritten.

Evidence: F1 on the full held-out set, and the adaptation visible in the app.

### 4. One real integration and a verified inbound webhook — 15 pts

Formalise one integration already connected, Resend or HubSpot. The example in the brief is course completion writing a CRM record. The webhook must:

- check the signature
- be idempotent
- retry

Evidence: a test that shows a bad signature is rejected, and a second delivery of the same event does not write a second record.

`resend-webhook` already checks a Svix signature for opened and failed mail. It is not the course-completion CRM webhook this concept asks for. Do not describe that mail webhook as this concept until the completion path and the idempotency test exist.

### 5. Eval in CI, plus observability and security — 15 pts

Sentry may stay. Add a CI gate that runs the eval harness and fails the build when RAG faithfulness or classifier F1 is below its threshold. Also keep rate limiting or caching, and a Supabase advisor pass on RLS.

Evidence: a CI run that shows the gate passing, and one that shows it blocking.

`.github/workflows/ci.yml` runs `scripts/eval-gate.ts` on the saved reports. A Vitest case with a lower score shows the gate blocking. A GitHub Actions run of this workflow is not recorded in this file until that workflow is pushed.

## Docs, Decision Log, and demo — 10 pts

Submit on Dev Control Tower with an `assessment-4` tag. The PDF text says `assessment-3` because that file titles itself Assessment 3. This repo uses `assessment-4` so it does not overwrite the earlier brief. The submission still needs:

- the live URL
- a public repo (a private repo can only be scored provisionally)
- role credentials
- a short write-up
- a 3–5 minute demo
- a Decision Log of about half a page

The Decision Log has three parts:

- **Done.** Each concept that shipped, and one line on how.
- **Cut.** Anything dropped or narrowed, and why.
- **Reflect.** What is strongest, and what would come next with more time.

The log is written at submission. Do not fill it in before the work exists.

## Bonuses

| Bonus                                                                             | Marks |
| --------------------------------------------------------------------------------- | ----: |
| Production polish: observability, guardrails, and a one-command reproducible demo |    +5 |
| One ambitious AI concept, finished                                                |    +5 |

## Scoring

| Criterion                                                               |   Marks |
| ----------------------------------------------------------------------- | ------: |
| Multi-agent orchestration and guardrails                                |      25 |
| Hybrid RAG and the evaluation harness, beside the Assessment 2 baseline |      20 |
| Trained or fine-tuned model, F1 at least 0.80, before and after         |      15 |
| One real integration and one verified inbound webhook                   |      15 |
| CI, observability, and security                                         |      15 |
| Architecture, docs, Decision Log, and a 3–5 minute demo                 |      10 |
| **Total**                                                               | **110** |

## Ground rules

- Build on the live app.
- Free tools only: Gemini free tier, Ollama, open-source models, pgvector, RAGAS, Langfuse free, or a free Colab GPU. No paid APIs.
- Keep the repo public for review.
- Every claim needs evidence: a metric, a before and after, or a run someone else can repeat.
- Do not invent a sender address, a tunnel URL, a threshold number the brief does not give, or a due date.
- Faithfulness and classifier F1 need numeric thresholds before the CI gate can fail a build. The brief does not give those numbers. Do not pick them until they are decided.
- Feature work still follows `AGENTS.md`: a feature spec under `specs/features/` before application code. This file is the assignment brief, not that feature spec.

## Status

The planner, retriever, and grader are specified in `features/student/student-course-tutor.md`. They are a card on the enrolled course, not a sidebar page. `ai-tutor` asks one question, then grades the answer. A successful grade trace is saved on that student’s tutor chat for the course. One live trace, for Advanced Developer Documentation and Process Mastery, is in `docs/assessment-4/tutor-trace.md`. `ai-tutor` was deployed on 24 November 2026. On that date the production database already had the chat tables and the tutor hourly limit.

Hybrid retrieval is specified in `features/student/student-hybrid-rag.md`. The catalogue search and the course tutor merge vector rows with English full-text rows. The score script writes `docs/assessment-4/hybrid-rag.md` beside the Assessment 2 report. The three extra scores are lexical stand-ins. They do not call a judge model.

The next tutor question follows the latest grade. `supported` asks a harder question. `partial` and `unsupported` ask an easier one. The card labels that change. The held-out macro F1 stays 1.000 on all 40 rows. The classifier still does not write `courses.level`.

The eval gate is specified in `features/student/student-eval-gate.md`. CI fails when All-row faithfulness is below 1.000 or either macro F1 is below 0.80. It reads the saved reports. It does not call a model.

The four-minute demo is `docs/assessment-4/demo.md`. `npm run demo:assessment-4` checks the saved trace and the score reports. It does not call a model.

Not started:

- A signature-checked, idempotent, retried webhook from course completion into the CRM.
- The Decision Log, the `assessment-4` tag, and the Dev Control Tower filing.
