# SJ Innovation Assessment 3 (continuation of Assessment 2)

## EduHub — Level 3: integrated, observable, production-grade AI

Learning Management System. Real integrations, multi-agent AI, and honest evaluation.

Extracted from `assessment-3.pdf`.

| | |
| --- | --- |
| Team member | Manju |
| Mentor | Amol — Tech Manager |
| Issued | Tuesday, 27 October 2026 |
| Due | Friday, 7 November 2026 — submit on Dev Control Tower |

## Where you got to in Assessment 2

A working EduHub LMS with a tool-calling Learning Assistant (search, describe, enrol, grades, suggest) on a Gemini edge function; two automations (course-completion → certificate, and assignment reminders on a cron); a 5,040-chunk RAG (5,000 FAQ via Ollama embeddings) with an honest 3-set noise eval; and a level classifier. Good, honest foundation to build on.

## Carry-over fixes from Assessment 2

Close these as part of Assessment 3:

- Finish the accuracy run on the full 40-row held-out set (the Gemini quota stopped it at 32) — run it on Ollama locally to avoid the quota.
- Stabilise RAG deployment: remove the temporary Cloudflare-tunnel-to-local-Ollama dependency — pre-compute and store embeddings so live search always works.
- Fix the deployed agent timeout (live 20s vs 45s in code).
- Re-tag `assessment-3` after the final corpus, cut a GitHub Release, and file the submission on Dev Control Tower (missed in Assessment 2).

## Assessment 3 in one line

Take EduHub and make it integrated (real third-party services + a campaign/CRM module), intelligent (multi-agent with guardrails), measured (a real agent/RAG evaluation harness, hybrid + re-rank), and production-grade (CI/CD, observability, security).

## Your seven tracks

### 1. Third-party integration (free tier) — 20 pts

Connect at least 2 real external services relevant to EduHub, with one outbound action and one inbound webhook (verify the signature):

- Resend / SendGrid (enrolment and certificate emails) and Google Calendar (class / assignment schedule sync) — or HubSpot for a student CRM.
- One outbound call + one inbound webhook (for example, email delivery status).

### 2. Campaign / CRM module — 15 pts

A student re-engagement module: learner segments (new / active / inactive), an email-campaign builder, and tracking (sent / opened / re-enrolled).

Sync to HubSpot or build it custom — it must have segments, a campaign/outreach action, and tracking.

### 3. Multi-agent orchestration + guardrails — 20 pts

Evolve the single Learning Assistant into a supervised multi-agent system:

- A tutor agent (explains a lesson).
- An advisor agent (recommends courses / a learning path).
- An enrolment agent (takes actions).
- A supervisor with shared memory and guardrails (PII redaction, low-confidence refusal, structured outputs).

The enrol / grades tools already exist — split and supervise them.

Required: a supervisor/router over specialist agents, shared memory, and guardrails (validation, PII redaction, low-confidence refusal, structured outputs).

### 4. Agent and RAG evaluation harness — 15 pts

Build an agent task-success eval on labelled scenarios. Upgrade RAG to hybrid (vector + full-text) with re-ranking and add faithfulness / answer-relevance metrics.

The Assessment 2 baseline was matching 1.00 / noisy 0.867 / extreme 0.133. Target a clear jump on the noisy and extreme sets and report side-by-side.

Deliver numbers: agent task-success %, and RAG hit-rate / precision@k + faithfulness / answer-relevance, side-by-side with the Assessment 2 results.

### 5. Model improvement / fine-tune — 10 pts

Finish what Assessment 2 started: run the level classifier on the full held-out set (only 32/40 were scored before the quota error), report precision / recall / F1 (target ≥0.85), and compare Ollama-local vs Gemini.

Report precision / recall / F1 (not just accuracy). Fine-tuning (LoRA / Ollama Modelfile) earns bonus.

### 6. CI/CD, observability and security — 15 pts

- GitHub Actions running the full test suite on push.
- Error tracking + logs/metrics (for example, Sentry free).
- A Supabase advisor pass fixing RLS/security findings.
- Rate-limiting / caching.
- Also fix the deployed agent timeout (live 20s vs 45s in code).

### 7. Architecture docs, demo and Dev Control Tower submission — 5 pts

An architecture diagram, the evaluation report (vs Assessment 2), a short demo, an `assessment-3` tag + GitHub Release, and — this time — actually file the submission on Dev Control Tower.

## Tooling and how-to (all free tiers)

### Third-party services

- Email: Resend / SendGrid free tier.
- Calendar: Google Calendar API.
- CRM: HubSpot free.
- Payments: Stripe test + webhooks.
- Chat: Slack webhooks.

Build one outbound call (you call them) and one inbound webhook (they call you — verify the signature).

### Deeper AI

- Multi-agent: a supervisor/router that delegates to specialist agents, each with its own tools; add memory and guardrails.
- Hybrid RAG: vector + keyword (Postgres full-text) retrieval, then re-rank the merged candidates; add citations.
- Evaluation: labelled scenarios → agent task-success %; for RAG report hit-rate / precision@k + faithfulness and answer-relevance, always vs the Assessment 2 baseline.
- Model: report precision / recall / F1; optionally fine-tune (LoRA on free Colab, or an Ollama Modelfile) and compare.

### Production engineering

- CI/CD: GitHub Actions on every push/PR.
- Observability: Sentry free + structured logs.
- Security: Supabase advisors, fix RLS, add rate-limiting and caching.

## How you will be scored

| Parameter | Max |
| --- | ---: |
| Third-party integration (≥2 services, 1 outbound + 1 inbound webhook) | 20 |
| Campaign / CRM module (segments, campaigns, tracking) | 15 |
| Multi-agent orchestration + guardrails + memory | 20 |
| Agent and RAG evaluation harness (hybrid + re-rank, metrics vs Assessment 2) | 15 |
| Model improvement (F1 reported, target; or fine-tune) | 10 |
| CI/CD + observability + security (RLS advisor) pass | 15 |
| Architecture docs, demo and Dev Control Tower submission | 5 |
| **Total** | **100** |
| Bonus — live integration in production; fine-tuned / local model used by the agent | +10 |

## What to submit on Dev Control Tower

1. Updated live URL + GitHub (tag an `assessment-3` release).
2. Architecture diagram showing agents, integrations and data flow.
3. Evaluation report — agent task-success + RAG metrics, side-by-side vs the Assessment 2 numbers.
4. Model metrics (precision/recall/F1; fine-tune comparison if attempted).
5. CI run link (green) + a note on the observability/security added.
6. A 3–5 min demo and updated role credentials.

## Additional approved slice

This slice does not replace the seven scored tracks. Track 3 still requires the supervisor, the specialist agents, and shared memory. Those agents call the shared guardrails when they are built. This slice does not build them.

| Spec | What it adds |
| --- | --- |
| `features/instructor/instructor-course-materials.md` | Private bucket `course-materials`, `course_materials`, and the content freeze. |
| `features/admin/admin-course-review.md` | Admin-triggered advisory review. Approve stays the only publish path. |
| `features/ai/ai-guardrails.md` | One module for the existing Gemini functions, the review, and the later supervisor. |

The migration is local until applying it is asked for. It is not in the repository until implementation starts.

## Golden rule

Depth over breadth, and close the Assessment 2 carry-overs first. One real integration + one solid multi-agent flow + honest evaluation beats five half-built features.

SJ Innovation — Internal. Assessment 3 (continuation of Assessment 2). Prepared by Amol (Tech Manager). Confidential.
