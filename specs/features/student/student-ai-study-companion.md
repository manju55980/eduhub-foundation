# Student AI Study Companion

Specifies the study companion on the enrolled-course learning view. The catalogue, enrollment, and lesson list stay in `student-browse-courses.md`. Roles and the route map stay in `product.md`. Schema and RLS stay in `architecture.md` and `supabase/migrations/20261009220000_create_lms_tables.sql`.

This feature does not add a table, column, policy, route, or sidebar item.

## Route

The companion is a card on `/student/my-courses/$courseId`, under that course’s lesson list. It is not a separate page.

## Behavior

A signed-in student asks one question about the course already open on the learning view. The card is absent unless that student is enrolled. The answer has an explanation, an example, and practice questions. Nothing is written to Supabase. Practice questions are not assignments and are not submissions.

The browser calls `supabase.functions.invoke("ai-study")` with `{ courseId, question }`. The call lives in `features/student/`. The route stays thin. Do not call Gemini from the browser, and do not send `GEMINI_API_KEY` to the browser.

The Edge Function checks the caller’s JWT and `profiles.role`. Only `student` is allowed. It then loads that course and the caller’s enrollment with the same JWT, so RLS applies. A missing course and a course the student has not joined both return “This course is not available.” The function does not call Gemini in that case, and it does not read lessons until the enrollment check passes.

If every lesson `content` is empty, including when the course has no lessons, the function does not call Gemini. The card says “This course has no lesson content yet.”

The model prompt includes only that course’s title, description, and lesson title and content. It does not include grades, submissions, other students, or other courses. The model is `gemini-3.5-flash-lite`. The reply is `{ explanation, example, practiceQuestions }` and is shown on the card only.

The question is required, trimmed, and at most 1,000 characters. A blank question is a form error. The submit control does not send a second request while one is in flight.

## UI

Follow the visual direction in `product.md`. The card heading is “Study Companion”.

- **Ready.** A question field and Ask, when the enrolled course has lesson content.
- **No lesson content.** The sentence “This course has no lesson content yet.” No Ask control.
- **Asking.** Ask does not send a second request.
- **Answer.** Show Explanation, Example, and Practice questions. The result can be dismissed. Dismissing it does not change the route or write a row.
- **Error.** Show the message inline. An error replaces the answer.

## Security checks

- **Role.** An instructor or admin token is rejected before any course read. The student layout still redirects other roles away from this screen.
- **Enrollment.** A student who is not enrolled, and a student who cannot see the course, both get “This course is not available.” Lessons are not read and Gemini is not called.
- **RLS.** The function uses the publishable key and the caller’s bearer token. It does not use the service-role client. Lesson reads are `title` and `content` only. Course reads are `title` and `description` only.
- **Secrets.** `GEMINI_API_KEY` stays in the function environment. A missing key returns “AI is not configured.” Responses do not include the key, an upstream body, or a `VITE_` variable.
- **No writes.** The companion does not insert or update `courses`, `lessons`, `assignments`, or `submissions`.

## Acceptance criteria

- An enrolled student with lesson content can ask one question and see an explanation, an example, and practice questions.
- The card is absent when the student is not enrolled.
- An enrolled course with no lesson content shows “This course has no lesson content yet.” and does not call Gemini.
- A blank question does not call the function.
- Dismissing an answer leaves the student on the learning view and does not write a row.
- An instructor or admin does not get this screen, and their token cannot use `ai-study`.
- A failed request shows the error and does not invent an answer.
