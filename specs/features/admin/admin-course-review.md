# Admin course review

Specifies an admin-triggered advisory review of a pending course. Publishing stays in `admin-approve-courses.md`. The publish payload stays `publish-course.ts`, which sends only `status: "published"`. Materials stay in `../instructor/instructor-course-materials.md`. Guardrails stay in `../ai/ai-guardrails.md`. Roles and the route map stay in `product.md`.

This slice is additional to the scored tracks in `assessment-3/assessment-3.md`. It does not add the tutor, advisor, enrolment supervisor, or shared memory. Those stay in that assessment spec. The review function calls the shared guardrails.

This feature adds the Edge Function `ai-course-review` and the `course_reviews` table. The migration is specified in `architecture.md`. It is not applied until that is asked for. No new route and no new sidebar item are added.

## Where it appears

| Screen | What is added |
| --- | --- |
| `/admin/courses/approvals` | On each pending card: the course’s materials, the newest review if one exists, and “Review with AI”. Approve stays on the card. |
| `/admin/courses` | The same block, only on a card whose status is `pending`. Archive is unchanged. Draft, published, and archived cards do not offer review. |

The control is not on Admin Dashboard, course details, or any instructor or student screen. Opening the page does not call the function.

## Review with AI

The browser calls `supabase.functions.invoke("ai-course-review")` with `{ courseId }` and the signed-in session. The call lives in `features/admin/`. The route stays thin. Do not call Gemini from the browser.

`verify_jwt` is true in `supabase/config.toml`. The function builds a Supabase client with the publishable key and the caller’s bearer token. It does not read `SUPABASE_SERVICE_ROLE_KEY`. Reads and the review insert run as that admin, so RLS applies.

The function reads `profiles.role` first. Only `admin` continues. It then loads that course. The course must be `pending`. A missing course and a course in any other status return “This course is not waiting for approval.” and do not call Gemini.

The prompt is built with the guardrails in `../ai/ai-guardrails.md`. It includes only:

- `courses.title`, `courses.description`, and `courses.level`
- that course’s lessons, in `order_index` order with nulls last, then `created_at`: `title` and `content`
- that course’s assignments: `title`, `description`, and `due_date`
- that course’s materials: `file_name` and `mime_type`

It does not include file bytes, `profiles.email`, `profiles.phone`, `profiles.full_name`, grades, submissions, enrollments, or any other course. The tool allowlist is empty. A reply that asks for a tool is invalid and is not stored.

The model is `gemini-3.5-flash-lite`, through `completeJson`. The reply is JSON:

```json
{
  "recommendation": "recommend",
  "confidence": 0.0,
  "summary": "",
  "findings": []
}
```

`recommendation` is `recommend` or `revise`. `confidence` is a number from 0 to 1 inclusive. `summary` is trimmed, required, and kept to 2,000 characters. `findings` is an array of trimmed strings. Empty strings are dropped. At most 8 findings are kept. Each finding is kept to 500 characters. Extra findings are dropped. A missing recommendation, a confidence outside 0 to 1, or a blank summary is “The AI response was not valid.” and does not insert.

A valid reply inserts one `course_reviews` row. It does not update `courses`, `lessons`, `assignments`, or `course_materials`. `revise` is stored text. It does not set the course back to `draft`, and it does not reject the course. Those transitions stay unspecified.

`confidence` below 0.70 is stored as sent. The screen shows the label “Low confidence” on that row. The summary and findings are still shown. The threshold is the shared constant in the guardrails spec. The label is computed from the stored number. It is not a second column.

A missing Gemini key returns “AI is not configured.” Any function error, invalid JSON, or low-confidence label leaves the course pending and leaves Approve available. The button does not call `publishCourse`.

Each click inserts a new row. Older rows stay. The card shows the newest `created_at` only. There is no update and no delete.

The admin browser does not insert `course_reviews` itself. RLS still allows an admin insert, because the function runs as that admin. RLS cannot prove the text came from Gemini. A forged row still cannot publish the course.

## Listing

Load the newest review for the pending course ids with the signed-in browser client. Also load `course_materials` for those ids: `file_name`, `mime_type`, `byte_size`, and `storage_path`. Download uses the 60-second signed URL from `instructor-course-materials.md`.

A course with no review shows the materials and “Review with AI”, and does not show a sample review. A course with no materials shows an empty file list. That does not block review or Approve.

## UI

Follow the visual direction in `product.md`. The review sits on the existing pending card. It is not a second card nested inside it.

- **Ready.** Approve is available whenever the pending list loaded, including when no review exists.
- **Reviewing.** The Review control that was used does not send a second call. Approve on that card is still available.
- **Reviewed.** Stay on the screen. Show “Recommend” or “Revise”, the stored confidence, the summary, and the findings. When confidence is below 0.70, also show “Low confidence”. The banner says “This review was saved.” It can be dismissed. Dismissing it does not delete the row or change the route.
- **Review error.** Show the function error inline. Approve stays. The error does not change `courses.status`.

Approve’s own submitting, published, and error states stay in `admin-approve-courses.md`. A failed publish still leaves the course pending. A successful publish still sends only `status`.

## Authorization

The admin layout already calls `requireRole("admin")`. A student or instructor is redirected before these screens mount.

An instructor token cannot call `ai-course-review` and cannot select `course_reviews`. Students cannot select that table.

## Out of scope

- Publishing, archiving, rejecting, or returning a course to draft.
- Hiding or disabling Approve when the review is missing, invalid, low-confidence, or “Revise”.
- Editing the course, its lessons, its assignments, or its files.
- Extracting text from an uploaded file.
- Running the review on a schedule or when the instructor submits.
- The multi-agent supervisor.

## Acceptance criteria

- An admin can run a review on a pending course. The function reads that course’s text fields and material names, inserts one `course_reviews` row, and does not update `courses.status`.
- `recommend` and `revise` are labels on the card. `revise` does not change the course status.
- Confidence below 0.70 shows “Low confidence” and still shows the summary and findings. Approve stays.
- A missing key, a failed call, or invalid JSON shows the error, inserts nothing, and leaves Approve available.
- A course that is not pending is not sent to Gemini.
- A student or instructor token cannot call the function.
- Approve on this card and on Manage Courses still calls `publishCourse` and still sends only `status`.
- The page does not call the function by itself.
