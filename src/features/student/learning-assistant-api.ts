import { supabase } from "@/integrations/supabase/client";

import { readFunctionResult } from "@/features/ai/function-result";
import {
  assistantContentLimit,
  parseAssistantResult,
  questionRequiredMessage,
} from "../../../supabase/functions/_shared/agent.ts";

export async function askLearningAssistant(threadId: string, content: string) {
  const trimmed = content.trim().slice(0, assistantContentLimit);
  if (!trimmed) return { ok: false as const, message: questionRequiredMessage };

  const { data, error } = await supabase.functions.invoke("ai-agent", {
    body: { threadId, content: trimmed },
  });
  const result = await readFunctionResult(data, error);
  if (!result.ok) return result;
  return parseAssistantResult(result.value);
}
