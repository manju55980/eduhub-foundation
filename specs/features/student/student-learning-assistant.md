# Student learning assistant

Specifies the catalogue assistant and its tool calls. Study Companion stays on the enrolled-course learning view in `student-ai-study-companion.md` and is unchanged. The corpus and `match_knowledge` stay in `student-rag-corpus.md`. Enrollment rules stay in `student-browse-courses.md`. Grades stay in `student-my-grades.md`. Roles and the route map stay in `product.md`.

This feature adds the Edge Function `ai-agent` and the page `/student/assistant`. It adds no table, column, policy, or migration. Chat transcripts are not stored. The function is deployed, and the page is implemented. A signed-in Chrome pass showed the empty prompt, “Enter a question.”, Sending, one assistant reply, and an offline error that restored the draft.

## Route

| Path | What it is |
| ---- | ---------- |
| `/student/assistant` | Learning Assistant. Sidebar label: “Learning Assistant”. No back link. |

The student layout already calls `requireRole("student")`. An instructor or admin is redirected before this page mounts.

## Request

The browser calls `supabase.functions.invoke("ai-agent")` with the signed-in session. The call lives in `features/student/`. The route stays thin. Do not call Gemini from the browser, and do not send `GEMINI_API_KEY` to the browser.

The body is `{ messages }`. Each message is `{ role, content }` where `role` is `user` or `assistant`. Keep the latest 8 messages. Trim each `content` and keep at most 1,000 characters. A missing or blank latest user message is a form error and does not call the function. The client does not send tool results. The function ignores any other role.

`verify_jwt` is true. The function builds a Supabase client with the publishable key and the caller’s bearer token. It does not read `SUPABASE_SERVICE_ROLE_KEY`. Queries and the enrollment insert run as that user, so the existing RLS policies apply.

The function reads `profiles.role` first. Only `student` continues. An instructor or admin token is rejected before any course, grade, or embedding call. A missing key returns “AI is not configured.” Logs follow the existing Gemini failure log: status and error type only, with no prompt, grade, or secret.

The chat model is `gemini-3.5-flash-lite`, through the same JSON completion path as `ai-study`. Each learning-assistant chat call times out after 45 seconds. Query embeddings use Ollama `nomic-embed-text` at 768 dimensions, with the same normalization and `search_query:` prefix as `rag_chunks`. `OLLAMA_HOST` is the Edge Function setting for that call. On 26 October 2026 it was an account-less Cloudflare quick tunnel, not a named production tunnel. The URL is not stored in this repository. Catalogue search fails while that tunnel, the local embed proxy, or Ollama is down. The earlier Chrome pass did not re-check `search_catalogue` after the embedding change.

## Tools

The model replies with JSON only. One reply is either a final answer or one tool call.

| Shape | Fields |
| ----- | ------ |
| Answer | `{ "type": "answer", "text": string, "courses": [{ "id": string, "title": string }] }` |
| Tool | `{ "type": "tool", "name": string, "arguments": object }` |

The server executes the tool and sends the tool result back to the model. It accepts at most 3 tool calls for one user message. A fourth requested call returns “I could not finish that request.” and does not execute it. An unknown tool name is rejected and is not sent to the database.

`courses` on a final answer may list only ids returned by a tool in this request. The server drops any other id. Recommendation and coverage sentences must come from those tool results. The model does not invent a course title.

| Tool | Arguments | What it does |
| ---- | --------- | ------------ |
| `search_catalogue` | `{ "query": string }` | Embeds `query` and calls `match_knowledge` for the top 5 rows. RLS already limits a student to FAQ chunks and published or enrolled course chunks, and to lesson chunks only when enrolled. |
| `describe_course` | `{ "courseId": string }` | Reads that course’s `title`, `description`, and `level` when `courses_select` returns it. Reads lesson `title` and `content` only when `is_enrolled` is true. Otherwise the tool result says the lesson text is unavailable. A course the student cannot see returns “This course is not available.” |
| `enrol_in_course` | `{ "courseId": string }` | Inserts one enrollment for the session user with `progress` 0, the same insert as Browse Courses. The existing `enrollments_insert_student` policy still requires a published course. |
| `fetch_my_grades` | `{}` | Reads the caller’s graded submissions only: assignment title, course title, `grade`, and `feedback`, newest 20. |
| `suggest_next_course` | `{}` | Reads the caller’s enrollments and published courses. Returns one published course the student has not joined. Prefer the same `category_id` as a completed enrollment, then the next `level` after the highest completed level (`beginner`, then `intermediate`, then `advanced`), then the newest published course. Returns no course when none is visible. |
| `count_published_courses` | `{}` | Counts courses with `status = published` through the caller’s Supabase client. `courses_select` already limits a student to published courses and courses they have joined, so the status filter is the published catalogue that student can see. The query asks for an exact count and does not fetch rows. It does not call `match_knowledge` and does not use the suggestion list. A count of 0 says there are no published courses. A query error says “The course count could not be loaded.” and does not invent a number. |

`enrol_in_course` runs only when the latest user message asks to enrol or join a course. A recommendation or a coverage question must not execute it. The insert does not send `id` or `created_at`. If that student is already enrolled, the tool returns the existing enrollment and does not insert. If the course is not published, the tool returns “This course is not available.” and does not insert. The tool cannot set `student_id` to anyone but the session user.

`fetch_my_grades` cannot accept a student id. The result includes no other student’s grade, feedback, or submission. `suggest_next_course` does not insert an enrollment. `count_published_courses` cannot accept a student id or a status. A question such as “How many total courses are there?” uses this count.

## UI

Follow the visual direction in `product.md`. The heading is “Learning Assistant”. One column. The transcript is a list, not a card nested in a card.

- **Empty.** No messages yet. The prompt is “Ask about a course, a recommendation, your grades, or the next course to take.”
- **Sending.** The send control does not start a second request.
- **Answer.** Show the student’s message and the assistant text. When the answer includes courses, list those titles. Each title opens that course’s details page, specified in `../course-details.md`. When `enrol_in_course` inserted a row, show “You are enrolled in this course.” with that title.
- **Error.** Show the message inline. An error does not invent an answer or an enrollment.

Dismissing the page drops the transcript. Nothing is written except an enrollment the enrol tool was allowed to insert. The study companion card is unchanged.

## Out of scope

- Replacing `ai-study` or `ai-course-builder`.
- Storing transcripts, study answers, or practice questions.
- Enroling another person, changing a grade, or publishing a course.
- Ollama, and an instructor quiz drafted from a lesson.
- The level classifier and the RAG query report.

## Acceptance criteria

- A student can ask for a recommendation and see course titles returned by `search_catalogue` or `suggest_next_course`.
- A coverage answer uses `describe_course`. Lesson text appears only for a course that student has joined.
- Asking to enrol in a published course inserts one enrollment with progress 0. Asking only for a recommendation does not insert.
- A second enrol for the same course does not insert another row.
- `fetch_my_grades` returns only the caller’s graded rows.
- “How many total courses are there?” is answered from `count_published_courses`. Zero published courses and a failed count each have their own message. The count is not the number of retrieved chunks.
- An instructor or admin token cannot use `ai-agent`.
- The function does not use the service-role client. Responses do not include the Gemini key.
- A blank message does not call the function. The empty, sending, and error states are shown. The transcript is not stored.
