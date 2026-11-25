import { useState, type FormEvent } from "react";

import { ErrorState } from "@/components/app-shell/page-state";
import { AiThreadBar } from "@/features/ai/ai-thread-panel";
import type { AiThreadMessage } from "@/features/ai/ai-thread-api";
import { useAiThread } from "@/features/ai/use-ai-thread";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { contextRoom } from "../../../supabase/functions/_shared/ai-thread.ts";
import { hasLessonContent, questionLimit } from "../../../supabase/functions/_shared/study.ts";

import { askStudyCompanion } from "./study-companion-api";

function textList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function StudyAnswer({ message }: { message: AiThreadMessage }) {
  const explanation = message.payload["explanation"];
  const example = message.payload["example"];
  const practice = textList(message.payload["practiceQuestions"]);
  if (typeof explanation !== "string" || typeof example !== "string" || practice.length === 0) {
    return (
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground [overflow-wrap:anywhere]">
        {message.content}
      </p>
    );
  }
  return (
    <div className="space-y-3">
      <StudyPart label="Explanation" value={explanation} />
      <StudyPart label="Example" value={example} />
      <div className="space-y-1">
        <h3 className="text-xs font-medium text-muted-foreground">Practice questions</h3>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-foreground">
          {practice.map((item, index) => (
            <li
              key={`${message.id}-${index}`}
              className="whitespace-pre-wrap [overflow-wrap:anywhere]"
            >
              {item}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

export function StudyCompanionCard({
  courseId,
  lessons,
}: {
  courseId: string;
  lessons: Array<{ content: string | null }>;
}) {
  const chat = useAiThread("study", courseId);
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const ready = hasLessonContent(lessons);
  const room = contextRoom(chat.messages.length, 2);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !ready || !room || !chat.threadId) return;

    setPending(true);
    setMessage("");
    const result = await askStudyCompanion(courseId, question, chat.threadId);
    setPending(false);

    if (!result.ok) {
      setMessage(result.message);
      return;
    }

    const asked = question.trim();
    chat.appendMessages([
      { id: `user-${chat.messages.length}`, role: "user", content: asked, payload: {} },
      {
        id: `assistant-${chat.messages.length}`,
        role: "assistant",
        content: result.explanation,
        payload: {
          explanation: result.explanation,
          example: result.example,
          practiceQuestions: result.practiceQuestions,
        },
      },
    ]);
    setQuestion("");
  }

  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-raised transition-[color,background-color,border-color,box-shadow] duration-200 ease-standard motion-reduce:transition-none">
      <div className="space-y-1">
        <h2 className="text-base font-medium text-foreground">Study Companion</h2>
        <p className="text-sm text-muted-foreground">
          Ask about this course. You will get an explanation, an example, and practice questions.
          This chat is saved.
        </p>
      </div>

      {ready ? (
        <>
          <AiThreadBar
            threads={chat.threads}
            threadId={chat.threadId}
            used={chat.messages.length}
            onSelect={(id) => void chat.selectThread(id)}
            onNew={() => void chat.newThread()}
            onClear={() => void chat.clearThread()}
          />
          {chat.messages.length > 0 ? (
            <ul className="min-w-0 space-y-4">
              {chat.messages.map((item) => (
                <li key={item.id} className="min-w-0 space-y-1 border-l-2 border-border pl-3">
                  <p className="text-xs font-medium text-muted-foreground">
                    {item.role === "user" ? "You" : "Study Companion"}
                  </p>
                  {item.role === "assistant" ? (
                    <StudyAnswer message={item} />
                  ) : (
                    <p className="whitespace-pre-wrap text-sm text-foreground [overflow-wrap:anywhere]">
                      {item.content}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          ) : null}
          <form className="space-y-3" onSubmit={(event) => void handleSubmit(event)}>
            <div className="space-y-2">
              <Label htmlFor="study-question">
                Question<span className="text-destructive"> *</span>
              </Label>
              <Textarea
                id="study-question"
                value={question}
                maxLength={questionLimit}
                placeholder="What should I study from this course?"
                className="min-h-24"
                onChange={(event) => setQuestion(event.target.value)}
                disabled={pending || !room}
              />
            </div>
            <Button
              type="submit"
              disabled={pending || !room || !chat.threadId || question.trim().length === 0}
            >
              {pending ? "Asking…" : "Ask"}
            </Button>
          </form>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">This course has no lesson content yet.</p>
      )}

      {message || chat.error ? <ErrorState message={message || chat.error} /> : null}
    </section>
  );
}

function StudyPart({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <h3 className="text-xs font-medium text-muted-foreground">{label}</h3>
      <p className="whitespace-pre-wrap text-sm text-foreground [overflow-wrap:anywhere]">
        {value}
      </p>
    </div>
  );
}
