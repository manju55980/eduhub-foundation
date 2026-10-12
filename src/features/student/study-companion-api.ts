import { supabase } from "@/integrations/supabase/client";

import { readFunctionResult } from "@/features/ai/function-result";
import { parseStudyReply, parseStudyRequest } from "../../../supabase/functions/_shared/study.ts";

export async function askStudyCompanion(courseId: string, question: string) {
  const parsed = parseStudyRequest({ courseId, question });
  if (!parsed.ok) return parsed;

  const { data, error } = await supabase.functions.invoke("ai-study", {
    body: { courseId: parsed.courseId, question: parsed.question },
  });
  const result = await readFunctionResult(data, error);
  if (!result.ok) return result;

  const reply = parseStudyReply(result.value);
  if (!reply.ok) return reply;
  return {
    ok: true as const,
    explanation: reply.explanation,
    example: reply.example,
    practiceQuestions: reply.practiceQuestions,
  };
}
