import { supabase } from "@/integrations/supabase/client";

type StudentEmailBody =
  | { action: "enrolment"; courseId: string }
  | { action: "completion"; courseId: string }
  | { action: "profile" };

async function notify(body: StudentEmailBody) {
  try {
    await supabase.functions.invoke("student-email", { body });
  } catch {
    return;
  }
}

export function notifyEnrolment(courseId: string) {
  return notify({ action: "enrolment", courseId });
}

export function notifyCourseCompletion(courseId: string) {
  return notify({ action: "completion", courseId });
}

export function notifyStudentProfile() {
  return notify({ action: "profile" });
}
