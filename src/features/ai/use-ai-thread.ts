import { useEffect, useState } from "react";

import type { AiSurface } from "../../../supabase/functions/_shared/ai-thread.ts";

import {
  clearAiMessages,
  createAiThread,
  listAiThreads,
  loadAiMessages,
  type AiThreadMessage,
  type AiThreadSummary,
} from "./ai-thread-api";

export function useAiThread(surface: AiSurface, courseId: string | null) {
  const [threads, setThreads] = useState<AiThreadSummary[]>([]);
  const [threadId, setThreadId] = useState("");
  const [messages, setMessages] = useState<AiThreadMessage[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function boot() {
      setReady(false);
      setError("");
      const listed = await listAiThreads(surface, courseId);
      if (!active) return;
      if (!listed.ok) {
        setError(listed.message);
        setReady(true);
        return;
      }

      let next = listed.threads;
      let id = next[0]?.id ?? "";
      if (!id) {
        const created = await createAiThread(surface, courseId);
        if (!active) return;
        if (!created.ok) {
          setError(created.message);
          setReady(true);
          return;
        }
        next = [created.thread];
        id = created.thread.id;
      }

      const loaded = await loadAiMessages(id);
      if (!active) return;
      setThreads(next);
      setThreadId(id);
      if (!loaded.ok) setError(loaded.message);
      setMessages(loaded.ok ? loaded.messages : []);
      setReady(true);
    }

    void boot();
    return () => {
      active = false;
    };
  }, [surface, courseId]);

  async function selectThread(id: string) {
    if (id === threadId) return;
    setError("");
    const loaded = await loadAiMessages(id);
    if (!loaded.ok) {
      setError(loaded.message);
      return;
    }
    setThreadId(id);
    setMessages(loaded.messages);
  }

  async function newThread() {
    if (messages.length === 0 && threadId) return;
    setError("");
    const created = await createAiThread(surface, courseId);
    if (!created.ok) {
      setError(created.message);
      return;
    }
    setThreads((current) => [created.thread, ...current]);
    setThreadId(created.thread.id);
    setMessages([]);
  }

  async function clearThread() {
    if (!threadId) return;
    setError("");
    const cleared = await clearAiMessages(threadId);
    if (!cleared.ok) {
      setError(cleared.message);
      return;
    }
    setMessages([]);
    setThreads((current) =>
      current.map((thread) => (thread.id === threadId ? { ...thread, title: "New chat" } : thread)),
    );
  }

  function appendMessages(next: AiThreadMessage[]) {
    setMessages((current) => [...current, ...next]);
  }

  return {
    threads,
    threadId,
    messages,
    ready,
    error,
    setError,
    selectThread,
    newThread,
    clearThread,
    appendMessages,
  };
}
