import { supabase } from "@/integrations/supabase/client";

import { readFunctionResult } from "@/features/ai/function-result";
import {
  parseAgentMessages,
  parseAssistantResult,
  type AgentMessage,
} from "../../../supabase/functions/_shared/agent.ts";

export async function askLearningAssistant(messages: AgentMessage[]) {
  const parsed = parseAgentMessages({ messages });
  if (!parsed.ok) return parsed;

  const { data, error } = await supabase.functions.invoke("ai-agent", {
    body: { messages: parsed.messages },
  });
  const result = await readFunctionResult(data, error);
  if (!result.ok) return result;
  return parseAssistantResult(result.value);
}
