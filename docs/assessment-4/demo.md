# Assessment 4 demo

About four minutes. Live app: [https://eduhub-foundation.vercel.app/](https://eduhub-foundation.vercel.app/). Sign in as the student who is already enrolled in **Advanced Developer Documentation and Process Mastery**. Do not read a password out of this file.

`npm run demo:assessment-4` checks that the saved tutor trace and the two score reports are still in place, then prints this order. It does not call Gemini or Ollama.

If the embed tunnel on this computer is down, or Gemini is busy, skip the live clicks and read the saved trace in `docs/assessment-4/tutor-trace.md`. That file is a real `ai-tutor` call from 26 November 2026.

## 0:00 Course tutor

Open My Courses, then that course. The card is **Check an answer**, under Study Companion. It is not a sidebar item and it is not the Learning Assistant.

Say: the function is the supervisor. It plans lessons from this course, retrieves notes, then asks one question. A later click grades the answer. Confidence below 0.70, or a verdict with no citation, is refused.

Choose **Give me a question**. The label is **Starting question**. The lesson text used to write the question stays hidden.

## 1:10 Grade

If the live question arrives, answer with one sentence from the notes: a 10x developer writes a 5-minute setup guide once, instead of repeating the same Slack reply. Choose **Check my answer**.

Point at three blocks: Plan, Retrieved context, and Feedback. The verdict is `supported`, `partial`, or `unsupported`, with the cited titles. No number is shown, and no submission is written.

If the live call does not return, open `docs/assessment-4/tutor-trace.md` and read this instead. The question asked what a 10x developer writes once. The plan listed six lessons. The retrieved notes included “The 10x Mindset: Documentation as Leverage.” The answer talked about living READMEs. The verdict was **unsupported**, citing that setup-guide lesson.

## 2:20 Harder or easier

On a successful grade, choose **Give me another question**. The label is **Harder than the last question** after `supported`, and **Easier than the last question** after `partial` or `unsupported`. The earlier grade stays on screen, so the before and the after are the two questions. The course level and the lessons are not rewritten.

## 3:00 Scores and the CI gate

Open `docs/assessment-4/hybrid-rag.md` beside `docs/assessment-2/rag-evaluation.md`. Same 90 questions. Vector Hit@5 on all 90 is 0.773. Hybrid Hit@5 is 0.520. Say that the keyword list pulled other notes above the nearest vector neighbour.

Faithfulness on the All row is 1.000 for both lists. That score copies a practice answer out of the retrieved text and checks the words. It is not a model judge.

The held-out level classifier is macro F1 1.000 on all 40 rows, in `docs/assessment-3/level-accuracy-comparison.md`. GitHub Actions runs `scripts/eval-gate.ts` on those saved files. The build fails if All-row faithfulness drops below 1.000 or either macro F1 drops below 0.80. The passing run on main is [CI run 9](https://github.com/manju55980/eduhub-foundation/actions/runs/45598494854). A unit test with faithfulness 0.999 or macro F1 0.799 shows the gate blocking.

## Leave out

- A course-completion webhook. Resend still records opened and failed mail only.
- A fine-tuned model. The classifier is the existing Gemini and Ollama comparison.
- A stable public tunnel URL. It changes when the tunnel restarts.
- The Decision Log, the `assessment-4` tag, and the Dev Control Tower filing. Those are not in this demo.
