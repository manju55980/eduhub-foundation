# Eval gate

Specifies the CI check for the saved hybrid report and the saved level-classifier report. The reports stay in `docs/assessment-4/hybrid-rag.md` and `docs/assessment-3/level-accuracy-comparison.md`. The scripts that produce them stay where they are. This check does not call Gemini or Ollama, and it does not open the database.

## Cutoffs

These cutoffs were chosen for this gate. The assignment brief does not supply them.

| Score                              | Cutoff | Report                                           |
| ---------------------------------- | -----: | ------------------------------------------------ |
| Vector faithfulness on the All row |  1.000 | `docs/assessment-4/hybrid-rag.md`                |
| Hybrid faithfulness on the All row |  1.000 | `docs/assessment-4/hybrid-rag.md`                |
| Gemini macro F1                    |   0.80 | `docs/assessment-3/level-accuracy-comparison.md` |
| Ollama macro F1                    |   0.80 | `docs/assessment-3/level-accuracy-comparison.md` |

A missing row, a missing number, or a number below its cutoff fails the check. A number equal to the cutoff passes.

## Where it runs

`scripts/eval-gate.ts` reads those two files and exits with a failure when the check fails. `.github/workflows/ci.yml` runs that script after the test step. The same check runs inside Vitest on the committed files.

A second Vitest case passes a report whose faithfulness is 0.999 and a report whose macro F1 is 0.799. That case expects a failure. It is the blocking example. It does not change the committed reports.

## What stays

Hourly AI limits stay in `private.consume_ai_request`. This gate does not add a cache and does not change those limits. Sentry stays as it is.

A security advisor check on 25 November 2026 returned no error-level row-policy findings. It returned warnings for six `security definer` functions that signed-in users can execute (`campaign_audience`, `create_campaign_snapshot`, `finish_campaign`, `mark_campaign_recipient_failed`, `mark_campaign_recipient_sent`, and `promote_student_to_instructor`) and for leaked-password protection being off. Those functions were left in place.

## Out of scope

- Rerunning the 90-query hybrid script or the 40-row classifier inside GitHub Actions.
- The course-completion webhook.
- Choosing a new cutoff after this file.
