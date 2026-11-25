import { useState, type FormEvent } from "react";

import { ErrorState } from "@/components/app-shell/page-state";
import { AiThreadBar } from "@/features/ai/ai-thread-panel";
import type { AiThreadMessage } from "@/features/ai/ai-thread-api";
import { useAiThread } from "@/features/ai/use-ai-thread";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { contextRoom } from "../../../supabase/functions/_shared/ai-thread.ts";
import {
  noLessonsMessage,
  tutorContentLimit,
  type TutorPlanItem,
  type TutorTrace,
} from "../../../supabase/functions/_shared/course-tutor.ts";

import { askCourseTutor, checkCourseTutorAnswer } from "./course-tutor-api";

function textValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function difficultyLabel(value: unknown) {
  if (value === "easier") return "Easier than the last question";
  if (value === "harder") return "Harder than the last question";
  if (value === "starting") return "Starting question";
  return "";
}

function pendingQuestion(messages: AiThreadMessage[]) {
  const last = messages[messages.length - 1];
  if (!last || last.role !== "assistant" || last.payload["mode"] !== "question") return "";
  return textValue(last.payload["question"]);
}

function isTrace(message: AiThreadMessage): message is AiThreadMessage & { payload: TutorTrace } {
  return (
    message.role === "assistant" &&
    message.payload["mode"] === "grade" &&
    message.payload["refused"] === false
  );
}

export function CourseTutorCard({
  courseId,
  lessonCount,
}: {
  courseId: string;
  lessonCount: number;
}) {
  const chat = useAiThread("tutor", courseId);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [answer, setAnswer] = useState("");
  const asked = pendingQuestion(chat.messages);
  const canAsk = contextRoom(chat.messages.length, 4);
  const canCheck = contextRoom(chat.messages.length, 2);

  async function ask(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (pending || !canAsk || !chat.threadId || lessonCount === 0) return;
    setPending(true);
    setError("");
    const result = await askCourseTutor(courseId, chat.threadId);
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    if (result.result.refused || result.result.mode !== "question") {
      const refusal = result.result.refused
        ? result.result.message
        : "The AI response was not valid.";
      if (!result.result.refused) setError(refusal);
      chat.appendMessages([
        {
          id: `user-${chat.messages.length}`,
          role: "user",
          content: "Give me a question",
          payload: {},
        },
        {
          id: `assistant-${chat.messages.length}`,
          role: "assistant",
          content: refusal,
          payload: result.result.refused ? { refused: true, message: result.result.message } : {},
        },
      ]);
      return;
    }
    setAnswer("");
    chat.appendMessages([
      {
        id: `user-${chat.messages.length}`,
        role: "user",
        content: "Give me a question",
        payload: {},
      },
      {
        id: `assistant-${chat.messages.length}`,
        role: "assistant",
        content: result.result.question,
        payload: {
          mode: "question",
          refused: false,
          question: result.result.question,
          difficulty: result.result.difficulty,
          plan: result.result.plan,
        },
      },
    ]);
  }

  async function check(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextAnswer = answer.trim();
    if (!asked || !nextAnswer || pending || !canCheck || !chat.threadId) return;
    setPending(true);
    setError("");
    const result = await checkCourseTutorAnswer({
      courseId,
      question: asked,
      answer: nextAnswer,
      threadId: chat.threadId,
    });
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setAnswer("");
    const content = result.result.refused
      ? result.result.message
      : result.result.mode === "grade"
        ? result.result.feedback.feedback
        : result.result.question;
    chat.appendMessages([
      { id: `user-${chat.messages.length}`, role: "user", content: nextAnswer, payload: {} },
      {
        id: `assistant-${chat.messages.length}`,
        role: "assistant",
        content,
        payload: result.result.refused
          ? { refused: true, message: result.result.message }
          : result.result,
      },
    ]);
  }

  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-raised transition-[color,background-color,border-color,box-shadow] duration-200 ease-standard motion-reduce:transition-none">
      <div className="space-y-1">
        <h2 className="text-base font-medium text-foreground">Check an answer</h2>
        <p className="text-sm text-muted-foreground">
          The tutor asks one question from this course. You write the answer. This chat is saved.
        </p>
      </div>

      {lessonCount === 0 ? (
        <p className="text-sm text-muted-foreground">{noLessonsMessage}</p>
      ) : (
        <AiThreadBar
          threads={chat.threads}
          threadId={chat.threadId}
          used={chat.messages.length}
          onSelect={(id) => void chat.selectThread(id)}
          onNew={() => void chat.newThread()}
          onClear={() => {
            void chat.clearThread();
            setAnswer("");
          }}
        />
      )}

      {chat.messages.length > 0 ? (
        <ul className="min-w-0 space-y-4">
          {chat.messages.map((item) => (
            <li key={item.id} className="min-w-0 space-y-1 border-l-2 border-border pl-3">
              <p className="text-xs font-medium text-muted-foreground">
                {item.role === "user" ? "You" : "Course Tutor"}
              </p>
              {isTrace(item) ? (
                <TutorTraceView trace={item.payload} />
              ) : item.payload["refused"] === true ? (
                <p className="text-sm leading-relaxed text-foreground">
                  {textValue(item.payload["message"])}
                </p>
              ) : (
                <div className="space-y-1">
                  {difficultyLabel(item.payload["difficulty"]) ? (
                    <p className="text-xs font-medium text-foreground">
                      {difficultyLabel(item.payload["difficulty"])}
                    </p>
                  ) : null}
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground [overflow-wrap:anywhere]">
                    {item.role === "assistant"
                      ? textValue(item.payload["question"]) || item.content
                      : item.content}
                  </p>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      {lessonCount > 0 && !asked ? (
        <form
          onSubmit={(event) => {
            void ask(event);
          }}
        >
          <Button type="submit" disabled={pending || !canAsk || !chat.threadId}>
            {pending ? "Preparing…" : "Give me a question"}
          </Button>
        </form>
      ) : null}

      {asked ? (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            void check(event);
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="tutor-answer">
              Your answer<span className="text-destructive"> *</span>
            </Label>
            <Textarea
              id="tutor-answer"
              value={answer}
              maxLength={tutorContentLimit}
              placeholder="Write a short answer."
              className="min-h-24"
              disabled={pending || !canCheck}
              onChange={(event) => setAnswer(event.target.value)}
            />
            <Button type="submit" disabled={pending || !canCheck || answer.trim().length === 0}>
              {pending ? "Checking…" : "Check my answer"}
            </Button>
          </div>
        </form>
      ) : null}

      {error || chat.error ? <ErrorState message={error || chat.error} /> : null}

      {lessonCount > 0 && chat.messages.length > 0 && !asked && !pending ? (
        <Button
          type="button"
          variant="outline"
          disabled={!canAsk || !chat.threadId}
          onClick={() => void ask()}
        >
          Give me another question
        </Button>
      ) : null}
    </section>
  );
}

function TutorTraceView({ trace }: { trace: TutorTrace }) {
  const plan = Array.isArray(trace.plan) ? trace.plan : [];
  const context = Array.isArray(trace.context) ? trace.context : [];
  return (
    <div className="min-w-0 space-y-4 border-t border-border pt-3">
      <section className="min-w-0 space-y-1">
        <h3 className="text-sm font-medium text-foreground">Plan</h3>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-foreground">
          {plan.map((lesson: TutorPlanItem) => (
            <li key={lesson.id} className="[overflow-wrap:anywhere]">
              {lesson.title}
            </li>
          ))}
        </ol>
      </section>
      <section className="min-w-0 space-y-2">
        <h3 className="text-sm font-medium text-foreground">Retrieved context</h3>
        <ul className="space-y-3">
          {context.map((chunk) => (
            <li key={chunk.id} className="min-w-0 space-y-1 border-l-2 border-border pl-3">
              <p className="text-sm text-foreground [overflow-wrap:anywhere]">{chunk.title}</p>
              <p className="text-xs text-muted-foreground">{chunk.sourceType}</p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground [overflow-wrap:anywhere]">
                {chunk.body}
              </p>
            </li>
          ))}
        </ul>
      </section>
      <section className="min-w-0 space-y-1">
        <h3 className="text-sm font-medium text-foreground">Feedback</h3>
        <p className="text-sm text-foreground">{trace.feedback.verdict}</p>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground [overflow-wrap:anywhere]">
          {trace.feedback.feedback}
        </p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-foreground">
          {trace.feedback.citations.map((citation) => (
            <li key={citation.id} className="[overflow-wrap:anywhere]">
              {citation.title}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
