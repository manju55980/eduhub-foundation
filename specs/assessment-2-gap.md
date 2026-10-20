# Assessment 2 gap analysis

Status as of 19 October 2026. This file records what is implemented, what the tests covered, and what is still open. It does not replace `assessment-2.md`. RAG and the level classifier are partially completed. Their reports and measured numbers stay as written. Gemini calls for those two tracks stay paused.

## Score tracks

| Track | Points | Status |
| --- | ---: | --- |
| Learning assistant | 20 | Checked in Chrome at `http://localhost:8081/student/assistant` with an existing student session. The empty prompt is shown. Enter on a blank question shows “Enter a question.” Sending appears while a request is open. A real question returned one assistant reply and cleared the draft. With the browser offline, the next send showed “Failed to send a request to the Edge Function” and restored that draft. `ai-agent` had been missing on the linked project and was deployed before the successful reply. |
| Two automations | 15 | Course completion is verified in Chrome against the linked database. The reminder endpoint is implemented. Hourly scheduling and deployment configuration are pending manual setup. The route has not been run against the database. |
| RAG corpus and retrieval report | 20 | Partially completed. The stored corpus has 572 chunks (6 course, 13 lesson, 553 FAQ). The retrieval report still scores the earlier 300-chunk run and was not re-run. Matching and noisy Hit@5 are both 1.000. Extreme rejection at cosine 0.75 is 1.000 and is stated outside the Hit@5 column. The 5,000 FAQ requirement is not met. |
| Held-out level accuracy | 15 | Partially completed. 16 of 40 held-out rows are classified, with accuracy 1.000 on those rows and coverage 0.400. The 19 October run stopped on a Gemini plan quota error. The partial report is written. The 0.70 target is not met. |
| Tests, including one end-to-end path | 15 | `npm run test:e2e` passed 1 test. That run is Vitest/jsdom. It does not verify live Supabase or a real browser. |
| UI feedback for the automations | 10 | Chrome confirmed Mark complete, the certificate sentence, both completion notices, and Mark read. My Courses prints the stored progress as an integer percent, such as `100%`. Mark complete shows “Saving…” and Mark read shows “Marking…” while each request is in flight. The reminder job has no browser surface. A signed-in student Chrome pass at 390px and 320px found no horizontal overflow on Browse Courses, My Courses, one enrolled course, Learning Assistant, Assignments, My Grades, or My Profile. The notification panel stayed inside the viewport (320px wide at 390px, 296px wide at 320px). The mobile sidebar was 288px wide, its labels were not clipped, and choosing a link closed it. No student page showed a table. Instructor and admin layouts were not opened at those widths. |
| README links to the two reports | 5 | The README records the agent, both workflows, the RAG design, the 300-chunk metrics, the partial accuracy result, and the test commands. It links both reports. The accuracy report does not meet the 0.70 bar. |

## Automations

Both workflows are implemented.

- Course completion is event-driven. Mark complete on `/student/my-courses/$courseId` inserts one `lesson_completions` row. `sync_enrollment_progress` sets progress. The existing `enrollments_sync_status` trigger sets `completed` at 100. `enrollments_issue_certificate` then inserts one certificate, one `course_completed` notification, and one `student_completed_course` notification. A second transition inserts nothing.
- Assignment reminders are implemented as `POST /api/assignment-reminders`. The route accepts only the cron bearer, then inserts `assignment_due` rows with the service-role client. The stages are 72h, 24h, and 1h, in non-overlapping windows. A null due date, a due date outside the next 72 hours, a student who already submitted, and a stored stage key produce no new row. A missed hour sends only the stage that is still open. Hourly scheduling and deployment configuration are pending manual setup: the published host has no built-in caller, so the hourly POST in the README still has to be configured after publish. The route has not been run against the database. A local POST to the dev server with no bearer returned 500 `Server configuration error`, which is the missing-secret response, and the job did not run.

`supabase/migrations/20261016220000_lesson_completions.sql` and `supabase/migrations/20261016221000_certificates_and_notifications.sql` are present on the linked database. The tables, indexes, policies, grants, and functions were already there, and no rows were dropped. The certificate trigger had to be recreated as `after update` with the same completed-status condition. `update of status` does not run when `sync_enrollment_progress` writes `progress` and `enrollments_sync_status` assigns `status` in that update. The reminder endpoint is implemented. Hourly scheduling and deployment configuration are pending manual setup, and the route has not been called against the database.

The latest focused run passed 24 tests across `src/features/notifications/workflows.test.ts`, the learning, My Courses, and instructor dashboard screens, and the two migration audits. Those tests use mocks and the SQL files. They do not open a browser and they do not apply SQL.

## RAG ingestion

Retrieval code, `match_knowledge`, and `scripts/seed-rag-chunks.ts` are implemented. `supabase/migrations/20261016222000_rag_chunks.sql` is applied on the linked project. The seed writes course and lesson chunks before FAQ rows, skips unchanged `source_key` values, and stops new FAQ rows once the stored total reaches `RAG_EMBED_RECORD_LIMIT` (default 300). A quota error still stops without retry.

On 19 October 2026 a one-text `gemini-embedding-001` probe returned 768 dimensions. The seed was then resumed with `RAG_EMBED_RECORD_LIMIT` 10000 so missing catalogue chunks stayed first and FAQ rows could continue toward 5,000. It kept 300 unchanged rows, embedded 96 more, and stopped on HTTP 429 for the plan quota. A later resume with a new key kept those 396 rows, embedded 176 more FAQ rows, and stopped again on the same plan-quota 429. A count of `rag_chunks` is 572: 6 course, 13 lesson, and 553 FAQ. The 5,000 FAQ bar is not met. Retrieval evaluation and the level classifier were not called after that stop.

`scripts/rag-evaluation.ts` was not run again. `docs/assessment-2/rag-evaluation.md` still scores the earlier 300-chunk corpus. Matching and noisy Hit@5 were both 1.000, so the noise delta is 0.000. Extreme rejection at cosine 0.75 was 1.000 for all 15 out-of-corpus queries. Hit@5 and MRR@5 are blank on that row. The mean top-1 cosine for that set is 0.537.

## Level accuracy

`scripts/level-accuracy.ts` keeps the seed-42 80/20 split (160 train, 40 test). Accuracy is correct predictions divided by successfully classified held-out rows. Infrastructure failures are excluded. The report is written only when accuracy is at least 0.70 and every held-out row was classified.

An earlier live run printed 0.400 because quota failures were counted as wrong answers. That figure is not the accuracy under the current rule.

On 19 October 2026 the script resumed 16 saved predictions in `scripts/fixtures/level-progress.json`, then Gemini returned HTTP 429 for the plan quota and the run stopped. Those saved predictions were left in place. Train count 160. Test count 40. Classified 16. Coverage 0.400. Accuracy on the classified rows 1.000. Classification errors 0. Infrastructure errors 1. Not attempted 23. The confusion matrix is 4 beginner, 8 intermediate, and 4 advanced, all correct. `docs/assessment-2/level-accuracy.md` records that partial result. The 0.70 target is not met.

The classifier was not called again after the embedding seed hit the same plan quota. The 16 saved predictions and the accuracy report are unchanged.

`src/test/level-accuracy.test.ts` and `src/features/ai/gemini-log.test.ts` passed together (13 tests) after the scoring change. Those tests mock Gemini.

## End-to-end happy path

`npm run test:e2e` passed 1 test in `src/test/student-happy-path.test.tsx`. The run uses Vitest and Testing Library in jsdom. One student enrolls in a published course, opens the lesson, marks that lesson complete, sees the certificate sentence, submits the assignment, and marks the course-complete notice read. A draft course stays off the catalogue. Setup seeds an in-memory store in `beforeEach`. `afterEach` clears enrollments, submissions, lesson completions, certificates, and notifications.

This run does not verify live Supabase or a real browser. It does not call Gemini, the RAG seed, or the classifier, and it does not apply schema. The completion certificate and notices come from that in-memory store. The live Chrome pass is recorded under Automations.

## Remaining gaps

The happy-path command is no longer an open implementation gap. The learning-assistant browser pass is no longer an open gap: empty, blank-question error, sending, one successful reply, and an offline error with the draft restored were all seen, and `ai-agent` is deployed. These items are still incomplete:

| Gap | Points still at risk | Why it is still incomplete |
| --- | ---: | --- |
| RAG corpus and retrieval report | 20 | Partially completed. 572 chunks are stored, including 553 FAQ rows. The retrieval report still scores the earlier 300-chunk run. The 5,000 FAQ requirement is not met. |
| Held-out level accuracy | 15 | Partially completed. 16 of 40 rows are classified at accuracy 1.000. Coverage is 0.400, with 23 rows not called. The partial report is written. The 0.70 target is not met. |
| Reminder scheduling | 15 | The endpoint is implemented. Hourly scheduling and deployment configuration are pending manual setup, and the route has not been run against the database. |
| Responsive layout | 10 | The student shell is checked at 390px and 320px, including Learning Assistant, the open notification panel, and the mobile sidebar. No student page showed a table, and none scrolled sideways. Instructor and admin layouts were not opened at those widths. On 19 October Chrome had no usable instructor or admin session, so that pass is still open. |
| Submission package | 5 | The README links both reports. `https://eduhub-foundation.vercel.app/` returned HTTP 200 and the EduHub title on 19 October 2026. Role-by-role checks on that URL were not run. The `assessment-2` git tag is not created. Role credentials are not in this repository. The Dev Control Tower submission is not filed. Full `npm test` output is not captured. |

The tests track’s required happy path is the 1 passing jsdom test above. Chrome covered the live completion path separately.

## Next highest-value task

RAG seeding is paused at 572 stored chunks after the latest plan-quota stop. The level classifier remains at 16 classified held-out rows. The retrieval and accuracy reports keep their measured numbers. The reminder endpoint stays as it is. Hourly reminder scheduling and deployment configuration remain a manual step after publish. The learning-assistant browser pass is recorded above. `ai-agent` is deployed.

The responsive student pass on 19 October opened a signed-in session at 390px and 320px. Browse Courses, My Courses, one enrolled course, Learning Assistant, Assignments, My Grades, and My Profile all kept `scrollWidth` equal to the viewport. The Learning Assistant question field was present. The notification panel measured 320px wide at 390px and 296px wide at 320px, inside the screen. The mobile sidebar measured 288px wide at both widths, its links were not clipped, and a menu choice closed the sidebar. No `table` element was rendered on those pages. The mobile menu had been staying open over the next page; a menu link now closes it. Instructor and admin layouts were not opened at those widths.

The next unfinished requirement is the instructor and admin phone layout. It was not opened on 19 October because Chrome had no usable instructor or admin session. The submission leftovers stay incomplete until the live URL is checked for each role, the `assessment-2` tag exists, role credentials are supplied outside this repository, the Dev Control Tower submission is filed, and a full test-run log is captured. RAG and the level classifier stay partially completed. Hourly reminder scheduling and deployment configuration remain a manual step after publish.
