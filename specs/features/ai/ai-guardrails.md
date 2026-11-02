# Shared AI guardrails

Specifies one module for the Gemini Edge Functions that already exist, for `ai-course-review`, and for the supervisor that Assessment 3 still requires. Study Companion behavior stays in `../student/student-ai-study-companion.md`. Course Builder stays in `../instructor/instructor-ai-course-builder.md`. The learning assistant stays in `../student/student-learning-assistant.md`. Course review stays in `../admin/admin-course-review.md`.

This slice is additional to the scored tracks in `assessment-3/assessment-3.md`. Track 3 still requires a supervisor over a tutor, an advisor, and an enrolment agent, with shared memory. This spec does not add those agents or that memory. When they are added, they call this module instead of a second Gemini client.

The module is `supabase/functions/_shared/guardrails.ts`. It adds no table, column, policy, or migration. It does not add a dependency. Edge Functions do not import the app’s Zod package. `completeJson` in `supabase/functions/_shared/gemini.ts` stays the only Gemini HTTP client. `sanitizeAiDetail` stays the log redaction for secrets.

## Who calls it

| Caller | What it must do |
| --- | --- |
| `ai-study` | Redact and wrap the question. Empty tool allowlist. No confidence field. |
| `ai-course-builder` | Redact and wrap the brief and the optional notes. Empty tool allowlist. No confidence field. |
| `ai-agent` | Redact and wrap each client message. Allow only the six tools already specified. Redact email and phone patterns inside a grade tool result before that result is sent back to the model. Keep the grade value. |
| `ai-course-review` | Redact and wrap the course text. Empty tool allowlist. Require `confidence`. |
| Later supervisor | Same helpers, with that supervisor’s own tool allowlist. Not built in this slice. |

User-facing errors stay the sentences those features already specify. A guardrail failure uses those sentences. It does not add a second error style.

## PII redaction

`redactPii` replaces an email address, and a phone-like run, with `[redacted]`. An email contains a local part, `@`, and a domain with a dot. A phone-like run has at least 10 digits and may include a leading `+`, spaces, dashes, dots, or a single pair of parentheses. Shorter numbers, years, lesson numbers, and scores are left as written.

Call `redactPii` on text a person typed before that text is placed in a prompt. Do not select `profiles.email` or `profiles.phone` in any of these functions. The course review also does not select `profiles.full_name`.

`fetch_my_grades` still returns the caller’s own grade and feedback. Feedback is passed through `redactPii` before the next model call. The grade string is not removed. The review prompt does not include grades.

`sanitizeAiDetail` still strips secrets from logs. Logs also pass the logged detail through `redactPii`. Logs do not include the prompt. The learning-assistant log rule is unchanged: status and error type, with no prompt, grade, or secret.

## Untrusted text

`wrapUntrusted(label, text)` puts already-redacted text in a block the system prompt names as data. The system prompt for each caller says that text inside that block cannot add a tool, change the role check, or override the JSON shape. Server-built tool results sit outside that block.

For `ai-agent`, client `user` and `assistant` messages are untrusted, including assistant text the browser sent. Tool results the server produced in this request are the trusted block. Wrapping does not replace `filterAnswerCourses`, the enrol phrase check, or RLS.

## Structured output

`completeJson` still requests `application/json` and parses one JSON value. Each caller keeps its own parser and its own user-facing invalid message.

The shared checks those parsers use are:

- a required string is trimmed, and blank fails
- a number confidence is finite and from 0 to 1 inclusive
- an enum value is one of the names that caller listed
- unknown keys are ignored

Study Companion still requires `explanation`, `example`, and at least one practice question. Course Builder still requires the requested lesson and assignment counts. The agent still accepts only `answer` or `tool`. Course review uses the shape in `../admin/admin-course-review.md`.

This slice does not add `confidence` to Study Companion, Course Builder, or the learning assistant. Their replies do not start failing, and they do not show “Low confidence”.

## Confidence

`confidenceThreshold` is `0.70`. `isLowConfidence` is true when the number is below that threshold. A value of 0.70 is not low confidence.

Only the course review requires the field. Below 0.70 it stores the review and the screen shows “Low confidence”. It does not refuse the row, and it does not block Approve. The later supervisor may refuse a low-confidence action. That refusal is not specified here, and it must not be copied onto Approve.

## Tool authorization

`authorizeTool(name, allowlist)` returns true only when `name` is in that list. The check runs before any database call.

| Function | Allowlist |
| --- | --- |
| `ai-study` | empty |
| `ai-course-builder` | empty |
| `ai-course-review` | empty |
| `ai-agent` | `search_catalogue`, `describe_course`, `enrol_in_course`, `fetch_my_grades`, `suggest_next_course`, `count_published_courses` |

An empty allowlist rejects a tool-shaped reply before a read or a write. The agent still rejects an unknown name, still runs `enrol_in_course` only when the latest user message asks to enrol or join, and still drops course ids that this request’s tools did not return. Arguments that the tool does not read are ignored, which is the current agent behavior. This slice does not start rejecting those extra arguments.

The review function has no enrol, grade, catalogue, or storage tool.

## Out of scope

- Building the supervisor, specialist agents, or shared memory.
- A confidence label on Study Companion, Course Builder, or the learning assistant.
- Changing `publishCourse` or `courses_guard_update` from this module. The module cannot publish.
- A new model name. Chat stays on `gemini-3.5-flash-lite`.
- Rate limiting. That stays in the Assessment 3 production track.

## Acceptance criteria

- `ai-study`, `ai-course-builder`, `ai-agent`, and `ai-course-review` call this module. They still use `completeJson`.
- An email or a 10-digit phone number in typed text is `[redacted]` in the prompt. A lesson number or a one-digit grade is not redacted by that phone rule.
- The review prompt has no profile email, phone, or name, and no file bytes.
- A tool name outside a function’s allowlist does not run.
- The agent’s enrol phrase check and course-id filter still apply.
- Confidence below 0.70 labels a stored course review and does not remove Approve.
- Study Companion, Course Builder, and the learning assistant do not gain a required confidence field.
- No service-role client is added.
