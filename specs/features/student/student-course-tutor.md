# Student course tutor

Specifies a supervisor over a planner, a retriever, and a grader for one enrolled course. The catalogue assistant stays in `student-learning-assistant.md` and is unchanged. Study Companion stays in `student-ai-study-companion.md` and is unchanged. The corpus and `match_knowledge` stay in `student-rag-corpus.md`. Enrollment stays in `student-browse-courses.md`. Instructor grading stays in `../instructor/instructor-grading.md`. Shared redaction, wrapping, and the 0.70 confidence check stay in `../ai/ai-guardrails.md`. Roles stay in `product.md`.

This feature adds a card on the enrolled course page and the Edge Function `ai-tutor`. It adds no route or sidebar item. The question, the plan, the retrieved rows, and the feedback are saved on that student’s `tutor` chat for this course. The trace is also in the response for that request.

The card and the function are in the repository. The hourly limit is in `supabase/migrations/20261123010000_ai_tutor_rate_limit.sql`. The chat tables are in `supabase/migrations/20261124180000_ai_threads.sql`. `ai-tutor` was deployed to project `thuaplbbrzkblozboymg` on 24 November 2026. On that date the production database already had `public.ai_threads`, `public.ai_messages`, `public.append_ai_turn`, and `ai-tutor` inside `private.consume_ai_request`. The Supabase migration history did not list these files, so they were not pushed again.

## Route

The card sits on `/student/my-courses/$courseId`, after Study Companion. It is not a separate page and it is not a sidebar item. The student layout already calls `requireRole("student")`. The card is absent unless that student is enrolled and the course has at least one lesson.

## Request

The browser calls `supabase.functions.invoke("ai-tutor")` with the signed-in session. The call lives in `features/student/`. The route stays thin. Do not call Gemini from the browser, and do not send `GEMINI_API_KEY` to the browser.

The first body is `{ courseId, mode: "question" }`. The function asks one question. The second body is `{ courseId, mode: "grade", question, answer }`. `question` is the question this function just asked, sent back by the card. `answer` is what the student typed. Both are trimmed and at most 1,000 characters. A blank answer does not call the function.

`verify_jwt` is true. The function builds a Supabase client with the publishable key and the caller’s bearer token. It does not read `SUPABASE_SERVICE_ROLE_KEY`. Reads run as that user, so the existing RLS policies apply.

The function reads `profiles.role` first. Only `student` continues. An instructor or admin token is rejected before any course, lesson, or embedding call. The function does not select `profiles.email`, `profiles.phone`, or `profiles.full_name`. It does not send the student id to the model.

`question` and `answer` are passed through `redactPii` and `wrapUntrusted` before either is placed in a prompt. Lesson rows and retrieved chunk rows are server data and sit outside that block. Logs follow the learning-assistant rule: status and error type only, with no prompt, answer, chunk body, or secret. Logged detail still passes through `redactPii`.

The chat model is `gemini-3.5-flash-lite`, through `completeChat`. A 503 or a high-demand reply is tried once more, then on `gemini-2.5-flash`. The planner call and the grader call each time out after 45 seconds. Query embeddings use Ollama `nomic-embed-text` at 768 dimensions, with the same normalization and `search_query:` prefix as `rag_chunks`. `OLLAMA_HOST` is the Edge Function setting for that call. Do not put that host in a `VITE_` variable. Retrieval fails closed when that host, the proxy, or Ollama is down, and the grader does not run.

The function calls `consume_ai_request` with `ai-tutor` before any model or embedding call. The hourly limit is 20, the same number as `ai-agent`. An unknown feature name is refused by the current function, so the implementation replaces the `case` in `private.consume_ai_request` to add `ai-tutor`. That migration does not add a table or a column. A spent limit returns “Too many AI requests. Try again later.” and does not call Gemini. A missing Gemini key returns “AI is not configured.”

## Supervisor

The Edge Function is the supervisor. A question request runs planner, retriever, then one question. A grade request runs planner, retriever, then the grader. It does not ask a model to choose a specialist. The current `ai-agent` supervisor, tutor, advisor, and enrolment specialist are not called.

1. Planner.
2. Retriever.
3. Question, or grader.

Each model step returns JSON only. Unknown keys are ignored. A required string is trimmed, and a blank string fails. `confidence` is a finite number from 0 to 1 inclusive. `isLowConfidence` is true below 0.70. A value of 0.70 is not low confidence. A low-confidence step, or a step that fails its evidence check, stops the run. Later steps do not run. The response is a refusal, and it does not include a verdict.

The tool allowlist is empty. A tool-shaped model reply is rejected. A successful turn appends the user message and the assistant message on that course’s tutor chat. A failed model call does not. The function does not insert a submission, an enrollment, or a lesson.

## Planner

The planner builds an ordered lesson path for the selected course only.

The function loads that course and the caller’s enrollment with the caller’s client. A missing course, a course the student cannot see, and a course the student has not joined all return “This course is not available.” Lessons are not read, and Gemini is not called.

When the course has no lessons, the function does not call Gemini. The page says “This course has no lessons yet.”

The planner prompt receives that course’s `title` and each lesson’s `id`, `title`, and `order_index`. It does not receive lesson `content`, other courses, grades, or submissions. The redacted question is the only student text in this prompt.

The planner reply is `{ "confidence": number, "lessons": [{ "id": string, "reason": string }] }`. The server keeps a lesson id only when it belongs to the selected course. Duplicate ids are dropped. The remaining ids stay in the model’s order. An id the model invented is dropped and is not shown. When confidence is low, or when no lesson id remains, the function refuses with “This request was refused because confidence was too low.” It does not embed a query and it does not grade.

## Retriever

The retriever uses the hybrid search in `student-hybrid-rag.md`. It keeps this course’s chunks and FAQ chunks, then the first 5.

The function embeds the redacted question and calls `match_knowledge` for 5 rows. A larger count still stops at 10 inside `match_knowledge`. The server then keeps a row only when:

- `source_type` is `faq`, or
- `source_type` is `course` or `lesson` and `course_id` is the selected course.

Any other course’s chunk is dropped. A student who is not enrolled still cannot receive lesson body text, because `match_knowledge` uses the existing student select policy and this function already refused an unenrolled course.

An embedding failure or a `match_knowledge` error returns “The AI request failed.” The grader does not run. When no row remains, the function does not call the grader. The page says “This answer was not graded because no course evidence was found.”

## Grader

The grader judges the student’s short answer against the retrieved rows only. It does not invent a verdict without a citation. It does not return a numeric score, a percentage, or a submission grade. It does not insert or update `submissions`, `assignments`, `enrollments`, `lessons`, or `courses`.

The grader prompt receives the redacted question, the redacted answer, the planned lesson ids and titles, and each remaining chunk’s `id`, `source_type`, `title`, and `body`.

The grader reply is `{ "confidence": number, "verdict": "supported" | "partial" | "unsupported", "feedback": string, "citations": string[] }`.

| Verdict       | Meaning                                          |
| ------------- | ------------------------------------------------ |
| `supported`   | The cited text supports the answer.              |
| `partial`     | The cited text supports only part of the answer. |
| `unsupported` | The cited text does not support the answer.      |

The server keeps a citation only when that id was returned by this request’s retriever. Any other id is dropped. When confidence is low, when `feedback` is blank, when `verdict` is not one of the three names, or when no citation remains, the function refuses. The refusal message is “This answer was not graded because confidence was too low.” The response does not include `verdict` or `feedback`.

## Response

A question response is `{ "ok": true, "mode": "question", "refused": false, "question": string, "difficulty": "starting" | "easier" | "harder", "plan": [...] }`. It has no `context` and no chunk body. A grade response is the trace below. A refusal is `{ "ok": true, "refused": true, "message": string }` and has no `feedback`. An error is `{ "ok": false, "message": string }`.

A completed grade trace has:

| Field      | What it contains                                                         |
| ---------- | ------------------------------------------------------------------------ |
| `mode`     | `grade`                                                                  |
| `question` | The question the student answered                                        |
| `refused`  | `false`                                                                  |
| `plan`     | The kept lessons, in the planner’s order: `id`, `title`, `orderIndex`    |
| `context`  | The kept chunks: `id`, `sourceType`, `title`, `body`, `similarity`       |
| `feedback` | `verdict`, `feedback`, and `citations` of `{ id, title }` from `context` |

The page shows a refusal `message` and does not show a verdict. A blank lesson title is shown as “Untitled lesson”. A blank chunk title is shown as “Untitled”.

## UI

Follow the visual direction in `product.md`. The card heading is “Check an answer”. The sentence under it is “The tutor asks one question from this course. You write the answer. This chat is saved.” Study Companion stays the card for explanations. A round meter shows how many of the 8 message slots are used. “Give me a question” needs 4 free slots so the later check still fits. “Check my answer” needs 2. At 8, both are disabled until Clear or New chat.

The question response does not include chunk bodies. The card shows the question and an answer field. After a grade response, the card shows Plan, Retrieved context, and Feedback. Plan lists lesson titles. Context lists each chunk’s title, source type, and body. Feedback shows the verdict, the feedback text, and the cited titles.

- **Ready.** “Give me a question”. No answer field yet.
- **Question.** The asked question and “Check my answer”. The first question is labelled “Starting question”. A later question is labelled “Easier than the last question” or “Harder than the last question”. A blank answer does not call the function.
- **Sending.** The button does not start a second request.
- **Refused.** Show the refusal message. Do not show a verdict or chunk bodies.
- **Error.** Show the message inline. An error does not invent a path, a chunk, or a verdict.
- **Another question.** “Give me another question” asks again. The next question is harder when the latest verdict is `supported`, and easier when it is `partial` or `unsupported`. The earlier plan, context, and feedback stay in the chat. The course level and the lessons stay as saved.

The card is absent when the student is not enrolled or the course has no lessons. Refreshing the page reloads the saved chat, including a graded trace. Clear deletes that chat’s messages. No submission is written.

## Out of scope

- Replacing `ai-agent`, `ai-study`, or `ai-course-builder`.
- Changing `courses.level` or the lesson a student sees from the level classifier.
- A course-completion webhook, a CRM write, or an eval gate in CI.
- Writing a grade, a submission, an enrollment, or a lesson completion.
- A numeric score or a percentage on the feedback.
- Grading any course other than the one selected.

## Acceptance criteria

- On an enrolled course with lessons, a student can ask for one question, answer it, and then see a plan, the retrieved context, and feedback. The question response does not include chunk bodies.
- The plan lists only lessons of the selected course. An invented lesson id is not shown.
- Retrieved course and lesson chunks are limited to that course. FAQ chunks may appear because the student can already read them. Another course’s lesson body is not shown.
- Feedback uses `supported`, `partial`, or `unsupported`, cites only chunks from that response, and does not include a numeric score.
- A response with no remaining citation, or with confidence below 0.70, shows a refusal and no verdict. A confidence of 0.70 is not refused.
- No row is inserted or updated in `submissions`, `assignments`, `enrollments`, `lessons`, or `courses`. A successful turn is stored on that student’s tutor chat.
- A student who has not joined the course receives “This course is not available.” and the function does not call Gemini.
- A course with no lessons does not call Gemini.
- A blank answer does not call the function. The sending, refusal, and error states are shown. The trace is saved on the course chat. There is no Course Tutor sidebar item.
- An instructor or admin token cannot use `ai-tutor`.
- The function does not use the service-role client. Responses do not include the Gemini key.
- `/student/assistant` and Study Companion behave as they do today.
