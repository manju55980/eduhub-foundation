import { redactPii, wrapUntrusted } from "./guardrails.ts";

export const contextWindowSize = 8;
export const contextContentLimit = 1000;
export const threadFullMessage = "This chat is full. Clear it or start a new chat.";
export const threadMissingMessage = "This chat is not available.";
export const threadReadMessage = "This chat could not be loaded.";
export const threadSaveMessage = "This chat could not be saved.";
export const newThreadTitle = "New chat";

const threadIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const aiSurfaces = [
  "assistant",
  "study",
  "tutor",
  "course_builder",
  "course_review",
] as const;

export type AiSurface = (typeof aiSurfaces)[number];

export type ThreadMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AiTurnWrite = {
  threadId: string;
  surface: AiSurface;
  courseId: string | null;
  slots: 2 | 4;
  userContent: string;
  assistantContent: string;
  payload: Record<string, unknown>;
};

export type AiThreadStore = {
  load: (input: {
    threadId: string;
    surface: AiSurface;
    courseId: string | null;
  }) => Promise<
    { ok: true; messages: ThreadMessage[] } | { ok: false; message: string; status: number }
  >;
  append: (
    input: AiTurnWrite,
  ) => Promise<{ ok: true; usage: number } | { ok: false; message: string; status: number }>;
};

export function contextRoom(messageCount: number, slots: 2 | 4) {
  return messageCount + slots <= contextWindowSize;
}

export function readThreadId(
  body: unknown,
): { ok: true; threadId: string | null } | { ok: false; message: string } {
  if (!body || typeof body !== "object" || !("threadId" in body)) {
    return { ok: true, threadId: null };
  }
  const raw = body.threadId;
  if (raw == null || raw === "") return { ok: true, threadId: null };
  if (typeof raw !== "string" || !threadIdPattern.test(raw.trim())) {
    return { ok: false, message: threadMissingMessage };
  }
  return { ok: true, threadId: raw.trim() };
}

export function readTurnContent(
  body: unknown,
  blankMessage: string,
): { ok: true; content: string } | { ok: false; message: string } {
  if (
    !body ||
    typeof body !== "object" ||
    !("content" in body) ||
    typeof body.content !== "string"
  ) {
    return { ok: false, message: blankMessage };
  }
  const content = body.content.trim().slice(0, contextContentLimit);
  if (!content) return { ok: false, message: blankMessage };
  return { ok: true, content };
}

export function withThreadHistory(user: string, messages: ThreadMessage[]) {
  if (messages.length === 0) return user;
  const lines = messages.map((message) => wrapUntrusted(message.role, redactPii(message.content)));
  return `${user}\n\nEarlier messages:\n${lines.join("\n")}`;
}

export async function openThreadTurn(
  threads: AiThreadStore | undefined,
  input: { threadId: string | null; surface: AiSurface; courseId: string | null; slots: 2 | 4 },
): Promise<
  | { ok: true; active: false }
  | { ok: true; active: true; messages: ThreadMessage[] }
  | { ok: false; message: string; status: number }
> {
  if (!input.threadId) return { ok: true, active: false };
  if (!threads) return { ok: false, status: 500, message: threadMissingMessage };
  const loaded = await threads.load({
    threadId: input.threadId,
    surface: input.surface,
    courseId: input.courseId,
  });
  if (!loaded.ok) return loaded;
  if (!contextRoom(loaded.messages.length, input.slots)) {
    return { ok: false, status: 409, message: threadFullMessage };
  }
  return { ok: true, active: true, messages: loaded.messages };
}

export async function persistThreadTurn(
  threads: AiThreadStore | undefined,
  active: boolean,
  input: AiTurnWrite,
): Promise<{ ok: true } | { ok: false; message: string; status: number }> {
  if (!active) return { ok: true };
  if (!threads || !input.threadId) return { ok: false, status: 500, message: threadSaveMessage };
  const saved = await threads.append(input);
  if (!saved.ok) return { ok: false, status: saved.status, message: saved.message };
  return { ok: true };
}

type StoredThread = {
  surface: AiSurface;
  courseId: string | null;
  messages: ThreadMessage[];
};

export function createMemoryThreads(
  seed: Array<{
    id: string;
    surface: AiSurface;
    courseId: string | null;
    messages?: ThreadMessage[];
  }>,
): AiThreadStore & { messages: (threadId: string) => ThreadMessage[] } {
  const threads = new Map<string, StoredThread>(
    seed.map((thread) => [
      thread.id,
      {
        surface: thread.surface,
        courseId: thread.courseId,
        messages: [...(thread.messages ?? [])],
      },
    ]),
  );

  return {
    messages(threadId) {
      return [...(threads.get(threadId)?.messages ?? [])];
    },
    async load(input) {
      const thread = threads.get(input.threadId);
      if (!thread || thread.surface !== input.surface || thread.courseId !== input.courseId) {
        return { ok: false, status: 404, message: threadMissingMessage };
      }
      return { ok: true, messages: thread.messages.map((message) => ({ ...message })) };
    },
    async append(input) {
      const thread = threads.get(input.threadId);
      if (!thread || thread.surface !== input.surface || thread.courseId !== input.courseId) {
        return { ok: false, status: 404, message: threadMissingMessage };
      }
      if (!contextRoom(thread.messages.length, input.slots)) {
        return { ok: false, status: 409, message: threadFullMessage };
      }
      const userContent = input.userContent.trim().slice(0, contextContentLimit);
      const assistantContent = input.assistantContent.trim().slice(0, contextContentLimit);
      if (!userContent || !assistantContent) {
        return { ok: false, status: 400, message: "Enter a question." };
      }
      thread.messages.push({ role: "user", content: userContent });
      thread.messages.push({ role: "assistant", content: assistantContent });
      return { ok: true, usage: thread.messages.length };
    },
  };
}

type QueryError = { message: string } | null;
type QueryResult = { data: unknown; error: QueryError };

type ThreadQuery = PromiseLike<QueryResult> & {
  eq: (column: string, value: string) => ThreadQuery;
  order: (column: string, options: { ascending: boolean }) => ThreadQuery;
  maybeSingle: () => Promise<QueryResult>;
};

export type AiThreadDb = {
  from: (table: string) => {
    select: (columns: string) => ThreadQuery;
  };
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: QueryError }>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function threadFailure(message: string) {
  if (message.includes(threadFullMessage)) {
    return { ok: false as const, status: 409, message: threadFullMessage };
  }
  if (message.includes(threadMissingMessage)) {
    return { ok: false as const, status: 404, message: threadMissingMessage };
  }
  return { ok: false as const, status: 500, message: threadSaveMessage };
}

export function bindAiThreads(db: AiThreadDb): AiThreadStore {
  return {
    async load(input) {
      const thread = await db
        .from("ai_threads")
        .select("id, surface, course_id")
        .eq("id", input.threadId)
        .maybeSingle();
      if (thread.error) return { ok: false, status: 500, message: threadReadMessage };
      if (!isRecord(thread.data) || thread.data["surface"] !== input.surface) {
        return { ok: false, status: 404, message: threadMissingMessage };
      }
      const courseId =
        typeof thread.data["course_id"] === "string" ? thread.data["course_id"] : null;
      if (courseId !== input.courseId) {
        return { ok: false, status: 404, message: threadMissingMessage };
      }

      const listed = await db
        .from("ai_messages")
        .select("role, content, created_at")
        .eq("thread_id", input.threadId)
        .order("created_at", { ascending: true });
      if (listed.error) return { ok: false, status: 500, message: threadReadMessage };
      const rows = Array.isArray(listed.data) ? listed.data : [];
      const messages: ThreadMessage[] = [];
      for (const row of rows) {
        if (!isRecord(row)) continue;
        if (row["role"] !== "user" && row["role"] !== "assistant") continue;
        if (typeof row["content"] !== "string" || !row["content"].trim()) continue;
        messages.push({
          role: row["role"],
          content: row["content"].trim().slice(0, contextContentLimit),
        });
      }
      return { ok: true, messages };
    },
    async append(input) {
      const { data, error } = await db.rpc("append_ai_turn", {
        target_thread_id: input.threadId,
        user_content: input.userContent,
        assistant_content: input.assistantContent,
        assistant_payload: input.payload,
        slots_needed: input.slots,
      });
      if (error) return threadFailure(error.message);
      const usage = typeof data === "number" ? data : Number(data);
      if (!Number.isInteger(usage)) return { ok: false, status: 500, message: threadSaveMessage };
      return { ok: true, usage };
    },
  };
}
