import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Link } from "@tanstack/react-router";

import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/app-shell/page-state";
import { PageSection } from "@/components/app-shell/record-card";
import { AiThreadBar } from "@/features/ai/ai-thread-panel";
import type { AiThreadMessage } from "@/features/ai/ai-thread-api";
import { useAiThread } from "@/features/ai/use-ai-thread";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { contextRoom } from "../../../supabase/functions/_shared/ai-thread.ts";
import {
  enrolledSentence,
  questionRequiredMessage,
} from "../../../supabase/functions/_shared/agent.ts";

import { askLearningAssistant } from "./learning-assistant-api";

const emptyPrompt =
  "Ask about a course, a recommendation, your grades, or the next course to take.";

type ChatCourse = { id: string; title: string };

function messageText(message: AiThreadMessage) {
  const text = message.payload["text"];
  return typeof text === "string" && text.trim() ? text : message.content;
}

function messageCourses(message: AiThreadMessage): ChatCourse[] {
  const courses = message.payload["courses"];
  if (!Array.isArray(courses)) return [];
  return courses.flatMap((course) => {
    if (!course || typeof course !== "object") return [];
    if (!("id" in course) || typeof course.id !== "string") return [];
    const title = "title" in course && typeof course.title === "string" ? course.title : "";
    return [{ id: course.id, title }];
  });
}

export function LearningAssistantScreen() {
  const questionRef = useRef<HTMLTextAreaElement>(null);
  const chat = useAiThread("assistant", null);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const room = contextRoom(chat.messages.length, 2);

  async function sendQuestion(content: string) {
    if (pending || !chat.ready || !chat.threadId || !room) return;
    if (!content) {
      setError(questionRequiredMessage);
      questionRef.current?.focus();
      return;
    }

    setDraft("");
    setPending(true);
    setError("");

    const result = await askLearningAssistant(chat.threadId, content);
    setPending(false);
    if (!result.ok) {
      setDraft(content);
      setError(result.message);
      questionRef.current?.focus();
      return;
    }

    const answer = result.enrolled ? `${result.text}\n\n${enrolledSentence}` : result.text;
    chat.appendMessages([
      { id: `user-${chat.messages.length}`, role: "user", content, payload: {} },
      {
        id: `assistant-${chat.messages.length}`,
        role: "assistant",
        content: answer,
        payload: { text: answer, courses: result.courses, enrolled: result.enrolled },
      },
    ]);
    questionRef.current?.focus();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendQuestion(draft.trim());
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    void sendQuestion(draft.trim());
  }

  const shownError = error || chat.error;

  return (
    <PageSection className="max-w-3xl">
      <PageHeader title="Learning Assistant" />
      <AiThreadBar
        threads={chat.threads}
        threadId={chat.threadId}
        used={chat.messages.length}
        onSelect={(id) => void chat.selectThread(id)}
        onNew={() => void chat.newThread()}
        onClear={() => void chat.clearThread()}
      />
      {chat.messages.length === 0 && !pending ? <EmptyState message={emptyPrompt} /> : null}
      {chat.messages.length > 0 ? (
        <ul aria-live="polite" aria-relevant="additions" className="min-w-0 space-y-4">
          {chat.messages.map((message) => {
            const courses = messageCourses(message);
            return (
              <li key={message.id} className="min-w-0 space-y-1 border-l-2 border-border pl-3">
                <p className="text-xs font-medium text-muted-foreground">
                  {message.role === "user" ? "You" : "Learning Assistant"}
                </p>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground [overflow-wrap:anywhere]">
                  {messageText(message)}
                </p>
                {courses.length > 0 ? (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Courses</p>
                    <ul className="list-disc space-y-1 pl-5 text-sm text-foreground">
                      {courses.map((course) => (
                        <li key={course.id} className="[overflow-wrap:anywhere]">
                          <Link
                            to="/student/courses/$courseId"
                            params={{ courseId: course.id }}
                            search={{ from: "assistant" }}
                            className="rounded-md text-sm underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                          >
                            {course.title || "Untitled course"}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
      {shownError ? <ErrorState message={shownError} /> : null}
      <form className="min-w-0 space-y-3" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <Label htmlFor="assistant-question">
            Question<span className="text-destructive"> *</span>
          </Label>
          <Textarea
            ref={questionRef}
            id="assistant-question"
            value={draft}
            maxLength={1000}
            placeholder="What course should I take next?"
            className="min-h-24"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            disabled={pending || !room}
          />
          <p className="text-xs leading-relaxed text-muted-foreground">
            Enter sends. Shift+Enter adds a line.
          </p>
        </div>
        {pending ? (
          <LoadingState message="Sending…" />
        ) : (
          <Button type="submit" disabled={!room || !chat.threadId || draft.trim().length === 0}>
            Send
          </Button>
        )}
      </form>
    </PageSection>
  );
}
