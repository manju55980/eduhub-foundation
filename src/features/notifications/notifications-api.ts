import { supabase } from "@/integrations/supabase/client";

export type AppNotification = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
};

export type CertificateRecord = {
  enrollmentId: string;
  courseId: string;
  issuedAt: string;
};

type QueryResult<T> = { data: T[] | null; error: { message: string } | null };
type SingleResult<T> = { data: T | null; error: { message: string } | null };

type Filter<T> = PromiseLike<QueryResult<T>> & {
  eq(column: string, value: string): Filter<T>;
  order(column: string, options: { ascending: boolean }): Filter<T>;
  maybeSingle(): PromiseLike<SingleResult<T>>;
};

type WorkflowClient = {
  from(table: "notifications" | "certificates" | "lesson_completions"): {
    select(columns: string): Filter<Record<string, unknown>>;
    insert(row: Record<string, unknown>): PromiseLike<{ error: { message: string } | null }>;
    update(row: Record<string, unknown>): Filter<Record<string, unknown>>;
  };
};

function workflowClient() {
  return supabase as unknown as WorkflowClient;
}

export function newestNotifications(rows: AppNotification[]) {
  return [...rows].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function shownCertificate(
  enrollmentStatus: string,
  enrollmentId: string,
  certificates: CertificateRecord[],
) {
  if (enrollmentStatus !== "completed") return null;
  return certificates.find((row) => row.enrollmentId === enrollmentId) ?? null;
}

export async function listNotifications(recipientId: string) {
  const result = await workflowClient()
    .from("notifications")
    .select("id, title, body, created_at, read_at")
    .eq("recipient_id", recipientId)
    .order("created_at", { ascending: false });
  if (result.error) return { ok: false as const, message: result.error.message };
  return {
    ok: true as const,
    notifications: newestNotifications(
      (result.data ?? []).map((row) => ({
        id: text(row, "id"),
        title: text(row, "title"),
        body: text(row, "body"),
        createdAt: text(row, "created_at"),
        readAt: nullableText(row, "read_at"),
      })),
    ),
  };
}

export async function listCertificates(studentId: string) {
  const result = await workflowClient()
    .from("certificates")
    .select("enrollment_id, course_id, issued_at")
    .eq("student_id", studentId);
  if (result.error) return { ok: false as const, message: result.error.message };
  return {
    ok: true as const,
    certificates: (result.data ?? []).flatMap((row) => {
      const enrollmentId = text(row, "enrollment_id");
      const courseId = text(row, "course_id");
      const issuedAt = text(row, "issued_at");
      if (!enrollmentId || !courseId || !issuedAt) return [];
      return [{ enrollmentId, courseId, issuedAt }];
    }),
  };
}

export async function markNotificationRead(notificationId: string, recipientId: string) {
  const result = await workflowClient()
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("recipient_id", recipientId);
  if (result.error) return { ok: false as const, message: result.error.message };
  return { ok: true as const };
}

export async function markLessonComplete(studentId: string, lessonId: string) {
  const result = await workflowClient()
    .from("lesson_completions")
    .insert({ student_id: studentId, lesson_id: lessonId });
  if (result.error) return { ok: false as const, message: result.error.message };
  return { ok: true as const };
}

export async function loadLessonProgress(courseId: string, studentId: string) {
  const enrollmentResult = await supabase
    .from("enrollments")
    .select("id, status")
    .eq("course_id", courseId)
    .eq("student_id", studentId)
    .maybeSingle();
  if (enrollmentResult.error) {
    return { ok: false as const, message: enrollmentResult.error.message };
  }
  if (!enrollmentResult.data) return { ok: true as const, enrolled: false as const };

  const completionResult = await workflowClient()
    .from("lesson_completions")
    .select("lesson_id")
    .eq("student_id", studentId);
  if (completionResult.error) {
    return { ok: false as const, message: completionResult.error.message };
  }

  const certificateResult = await workflowClient()
    .from("certificates")
    .select("issued_at")
    .eq("enrollment_id", enrollmentResult.data.id)
    .maybeSingle();
  if (certificateResult.error) {
    return { ok: false as const, message: certificateResult.error.message };
  }

  return {
    ok: true as const,
    enrolled: true as const,
    enrollmentStatus: enrollmentResult.data.status,
    completedLessonIds: (completionResult.data ?? []).map((row) => text(row, "lesson_id")),
    certificateIssuedAt: certificateResult.data
      ? nullableText(certificateResult.data, "issued_at")
      : null,
  };
}

function text(row: Record<string, unknown>, key: string) {
  const value = row[key];
  return typeof value === "string" ? value : "";
}

function nullableText(row: Record<string, unknown>, key: string) {
  const value = row[key];
  return typeof value === "string" ? value : null;
}
