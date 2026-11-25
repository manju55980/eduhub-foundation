import { supabase } from "@/integrations/supabase/client";

import { readFunctionResult } from "@/features/ai/function-result";
import {
  parseTutorRequest,
  parseTutorResult,
} from "../../../supabase/functions/_shared/course-tutor.ts";

export async function askCourseTutor(courseId: string, threadId?: string) {
  const parsed = parseTutorRequest({ courseId, mode: "question" });
  if (!parsed.ok) return parsed;

  const { data, error } = await supabase.functions.invoke("ai-tutor", {
    body: {
      courseId: parsed.courseId,
      mode: "question",
      ...(threadId ? { threadId } : {}),
    },
  });
  const result = await readFunctionResult(data, error);
  if (!result.ok) return result;
  return parseTutorResult(result.value);
}

export async function checkCourseTutorAnswer(input: {
  courseId: string;
  question: string;
  answer: string;
  threadId?: string;
}) {
  const parsed = parseTutorRequest({ ...input, mode: "grade" });
  if (!parsed.ok) return parsed;
  if (parsed.mode !== "grade") return { ok: false as const, message: "The request was not valid." };

  const { data, error } = await supabase.functions.invoke("ai-tutor", {
    body: {
      courseId: parsed.courseId,
      mode: "grade",
      question: parsed.question,
      answer: parsed.answer,
      ...(input.threadId ? { threadId: input.threadId } : {}),
    },
  });
  const result = await readFunctionResult(data, error);
  if (!result.ok) return result;
  return parseTutorResult(result.value);
}
