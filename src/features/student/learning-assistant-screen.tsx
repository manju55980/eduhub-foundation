import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Link } from "@tanstack/react-router";

import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/app-shell/page-state";
import { PageSection } from "@/components/app-shell/record-card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  enrolledSentence,
  questionRequiredMessage,
} from "../../../supabase/functions/_shared/agent.ts";

import { askLearningAssistant } from "./learning-assistant-api";

const emptyPrompt =
  "Ask about a course, a recommendation, your grades, or the next course to take.";

type ChatCourse = { id: string; title: string };
type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  courses: ChatCourse[];
};

export function LearningAssistantScreen() {
  const questionRef = useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  async function sendQuestion(content: string) {
    if (pending) return;
    if (!content) {
      setError(questionRequiredMessage);
      questionRef.current?.focus();
      return;
    }

    const history = [...messages, { role: "user" as const, content, courses: [] }];
    setMessages(history);
    setDraft("");
    setPending(true);
    setError("");

    const result = await askLearningAssistant(
      history.map(({ role, content: text }) => ({ role, content: text })),
    );
    setPending(false);
    if (!result.ok) {
      setMessages((current) => current.slice(0, -1));
      setDraft(content);
      setError(result.message);
      questionRef.current?.focus();
      return;
    }

    const answer = result.enrolled ? `${result.text}\n\n${enrolledSentence}` : result.text;
    setMessages([...history, { role: "assistant", content: answer, courses: result.courses }]);
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

  return (
    <PageSection className="max-w-3xl">
      <PageHeader title="Learning Assistant" />
      {messages.length === 0 && !pending ? <EmptyState message={emptyPrompt} /> : null}
      {messages.length > 0 ? (
        <ul aria-live="polite" aria-relevant="additions" className="min-w-0 space-y-4">
          {messages.map((message, index) => (
            <li
              key={`${message.role}-${index}`}
              className="min-w-0 space-y-1 border-l-2 border-border pl-3"
            >
              <p className="text-xs font-medium text-muted-foreground">
                {message.role === "user" ? "You" : "Learning Assistant"}
              </p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground [overflow-wrap:anywhere]">
                {message.content}
              </p>
              {message.courses.length > 0 ? (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Courses</p>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-foreground">
                    {message.courses.map((course) => (
                      <li key={course.id} className="[overflow-wrap:anywhere]">
                        <Link
                          to="/student/courses/$courseId"
                          params={{ courseId: course.id }}
                          search={{ from: "assistant" }}
                          className="underline-offset-2 hover:underline"
                        >
                          {course.title || "Untitled course"}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {pending ? <LoadingState message="Sending…" /> : null}
      {error ? <ErrorState message={error} /> : null}
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
            disabled={pending}
          />
          <p className="text-xs leading-relaxed text-muted-foreground">
            Enter sends. Shift+Enter adds a line.
          </p>
        </div>
        <Button type="submit" disabled={pending || draft.trim().length === 0}>
          {pending ? "Sending…" : "Send"}
        </Button>
      </form>
    </PageSection>
  );
}
