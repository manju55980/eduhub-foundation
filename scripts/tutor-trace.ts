import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

import { isServiceRoleKey } from "../supabase/functions/_shared/user-client.ts";

loadLocalEnv();

const courseId = "35795e4f-02c1-4174-b687-9b45a5185ee4";
const root = fileURLToPath(new URL("..", import.meta.url));
const reportPath = resolve(root, "docs/assessment-4/tutor-trace.md");
const url = process.env.SUPABASE_URL?.trim() || process.env.VITE_SUPABASE_URL?.trim() || "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
const publishable =
  process.env.SUPABASE_PUBLISHABLE_KEY?.trim() ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  "";
if (!url || !isServiceRoleKey(serviceKey) || !publishable || isServiceRoleKey(publishable)) {
  console.error("The service role key and the publishable key are required.");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const enrolled = await admin
  .from("enrollments")
  .select("student_id")
  .eq("course_id", courseId)
  .eq("status", "active")
  .limit(1);
const studentId = enrolled.data?.[0]?.student_id;
if (enrolled.error || !studentId) {
  console.error("An active enrollment is required.");
  process.exit(1);
}
const user = await admin.auth.admin.getUserById(studentId);
const email = user.data.user?.email;
if (!email) {
  console.error("Could not open a student session.");
  process.exit(1);
}
const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
const tokenHash = link.data.properties?.hashed_token;
if (link.error || !tokenHash) {
  console.error("Could not open a student session.");
  process.exit(1);
}
const student = createClient(url, publishable, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const verified = await student.auth.verifyOtp({ type: "magiclink", token_hash: tokenHash });
const access = verified.data.session?.access_token;
if (verified.error || !access) {
  console.error("Could not open a student session.");
  process.exit(1);
}

const course = await student.from("courses").select("title").eq("id", courseId).maybeSingle();
const courseTitle = course.data?.title ?? "Untitled course";
const chunk = await student
  .from("rag_chunks")
  .select("body")
  .eq("course_id", courseId)
  .eq("source_type", "lesson")
  .limit(1);
const source = (chunk.data?.[0]?.body ?? "").replace(/\s+/g, " ").trim();
const answer = source.slice(0, 500);
if (!answer) {
  console.error("This course has no lesson note to answer from.");
  process.exit(1);
}

const thread = await student
  .from("ai_threads")
  .insert({ user_id: studentId, surface: "tutor", course_id: courseId, title: "Tutor trace" })
  .select("id")
  .single();
if (thread.error || !thread.data?.id) {
  console.error(thread.error?.message ?? "The tutor chat could not be opened.");
  process.exit(1);
}

const asked = await callTutor({ courseId, mode: "question", threadId: thread.data.id }, access);
if (!asked.ok || asked.mode !== "question" || asked.refused) {
  console.error(messageOf(asked));
  process.exit(1);
}
console.log(`Question: ${text(asked.question)}`);
let graded = await callTutor(
  {
    courseId,
    mode: "grade",
    threadId: thread.data.id,
    question: String(asked.question),
    answer,
  },
  access,
);
if (!graded.ok || graded.refused) {
  graded = await callTutor(
    {
      courseId,
      mode: "grade",
      threadId: thread.data.id,
      question: String(asked.question),
      answer,
    },
    access,
  );
}
if (!graded.ok || graded.mode !== "grade" || graded.refused) {
  console.error(messageOf(graded));
  process.exit(1);
}

writeFileSync(reportPath, renderTrace(courseTitle, asked, graded, answer), "utf8");
console.log("Wrote docs/assessment-4/tutor-trace.md.");

async function callTutor(body: Record<string, string>, accessToken: string) {
  const response = await fetch(`${url}/functions/v1/ai-tutor`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: publishable,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as Record<string, unknown>;
  return payload;
}

function messageOf(payload: Record<string, unknown>) {
  return typeof payload.message === "string" ? payload.message : "The tutor call failed.";
}

function renderTrace(
  title: string,
  asked: Record<string, unknown>,
  graded: Record<string, unknown>,
  studentAnswer: string,
) {
  const plan = Array.isArray(asked.plan) ? asked.plan : [];
  const context = Array.isArray(graded.context) ? graded.context : [];
  const feedback =
    graded.feedback && typeof graded.feedback === "object"
      ? (graded.feedback as Record<string, unknown>)
      : {};
  const citations = Array.isArray(feedback.citations) ? feedback.citations : [];
  const lines = [
    "# Tutor trace",
    "",
    `One live call to \`ai-tutor\` for ${title}, on 26 November 2026. The question and the grade were saved on that student's tutor chat.`,
    "",
    "## Question",
    "",
    `Difficulty: ${text(asked.difficulty)}`,
    "",
    text(asked.question),
    "",
    "## Plan",
    "",
    ...plan.map((item) => {
      const lesson = item as Record<string, unknown>;
      return `- ${text(lesson.title)}`;
    }),
    "",
    "## Answer",
    "",
    studentAnswer,
    "",
    "## Retrieved context",
    "",
  ];
  for (const item of context) {
    const chunkRow = item as Record<string, unknown>;
    lines.push(
      `### ${text(chunkRow.title)}`,
      "",
      `Source: ${text(chunkRow.sourceType)}`,
      "",
      text(chunkRow.body),
      "",
    );
  }
  lines.push(
    "## Feedback",
    "",
    `Verdict: ${text(feedback.verdict)}`,
    "",
    text(feedback.feedback),
    "",
    "Citations:",
    "",
    ...citations.map((item) => `- ${text((item as Record<string, unknown>).title)}`),
    "",
  );
  return lines.join("\n");
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "Untitled";
}

function loadLocalEnv() {
  try {
    const file = readFileSync(new URL("../.env", import.meta.url), "utf8");
    for (const line of file.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const separator = trimmed.indexOf("=");
      if (separator === -1) continue;
      const name = trimmed.slice(0, separator).trim();
      let value = trimmed.slice(separator + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[name] === undefined) process.env[name] = value;
    }
  } catch {
    // The shell environment is enough when no local env file is present.
  }
}
