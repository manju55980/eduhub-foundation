export const failedAiMessage = "The AI request failed.";

export function sanitizePublicMessage(message: string) {
  if (
    message.includes("OPENAI_API_KEY") ||
    message.includes("GEMINI_API_KEY") ||
    message.includes("service_role") ||
    message.includes("sb_secret_") ||
    /sk-[A-Za-z0-9]/.test(message) ||
    /AIza[0-9A-Za-z_-]{10,}/.test(message)
  ) {
    return failedAiMessage;
  }
  return message;
}

export async function readFunctionResult(
  data: unknown,
  error: { message: string; context?: unknown } | null,
): Promise<{ ok: true; value: unknown } | { ok: false; message: string }> {
  if (error) return { ok: false, message: await messageFromInvokeError(error) };
  if (!data || typeof data !== "object") return { ok: false, message: failedAiMessage };
  if ("ok" in data && data.ok === false) {
    const message =
      "message" in data && typeof data.message === "string" ? data.message : failedAiMessage;
    return { ok: false, message: sanitizePublicMessage(message) };
  }
  if ("ok" in data && data.ok === true) return { ok: true, value: data };
  return { ok: false, message: failedAiMessage };
}

async function messageFromInvokeError(error: { message: string; context?: unknown }) {
  const context = error.context;
  if (context instanceof Response) {
    try {
      const body: unknown = await context.clone().json();
      if (
        body &&
        typeof body === "object" &&
        "message" in body &&
        typeof body.message === "string"
      ) {
        const message = body.message.trim();
        if (message) return sanitizePublicMessage(message);
      }
    } catch {
      return failedAiMessage;
    }
  }
  return sanitizePublicMessage(error.message.trim() || failedAiMessage);
}
