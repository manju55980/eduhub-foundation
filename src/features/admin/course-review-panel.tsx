import { useEffect, useRef, useState } from "react";

import { MetaItem, MetaList } from "@/components/app-shell/record-card";
import { AiThreadBar } from "@/features/ai/ai-thread-panel";
import type { AiThreadMessage } from "@/features/ai/ai-thread-api";
import { useAiThread } from "@/features/ai/use-ai-thread";
import { Button } from "@/components/ui/button";
import { SaveNotice } from "@/features/instructor/save-notice";
import { contextRoom } from "../../../supabase/functions/_shared/ai-thread.ts";

import { requestCourseReview } from "./course-review-api";
import { formatConfidence, recommendationLabel, type CourseReview } from "./course-review";

const savedMessage = "This review was saved.";

export function CourseReviewPanel({
  courseId,
  review,
}: {
  courseId: string;
  review: CourseReview | null;
}) {
  const chat = useAiThread("course_review", courseId);
  const [fresh, setFresh] = useState<CourseReview | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const active = useRef(true);
  const shown = fresh ?? review;
  const room = contextRoom(chat.messages.length, 2);

  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);

  async function handleReview() {
    if (reviewing || !room || !chat.threadId) return;
    setReviewing(true);
    setSaved(false);
    setError("");
    const result = await requestCourseReview(courseId, chat.threadId);
    if (!active.current) return;
    setReviewing(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setFresh(result.review);
    setSaved(true);
    chat.appendMessages([
      {
        id: `user-${chat.messages.length}`,
        role: "user",
        content: "Review this course",
        payload: {},
      },
      {
        id: `assistant-${chat.messages.length}`,
        role: "assistant",
        content: result.review.summary,
        payload: { ...result.review },
      },
    ]);
  }

  return (
    <div className="space-y-3 border-t border-border pt-3">
      <AiThreadBar
        threads={chat.threads}
        threadId={chat.threadId}
        used={chat.messages.length}
        onSelect={(id) => void chat.selectThread(id)}
        onNew={() => void chat.newThread()}
        onClear={() => void chat.clearThread()}
      />
      <SaveNotice
        tone="admin"
        saved={saved}
        message={saved ? savedMessage : error || chat.error}
        onDismiss={() => {
          setSaved(false);
          setError("");
          chat.setError("");
        }}
      />
      {chat.messages.length > 0 ? (
        <ul className="space-y-3">
          {chat.messages
            .filter((item) => item.role === "assistant")
            .map((item) => {
              const stored = reviewFromMessage(item);
              if (!stored) return null;
              return (
                <li key={item.id}>
                  <SavedReview review={stored} />
                </li>
              );
            })}
        </ul>
      ) : null}
      {shown && chat.messages.length === 0 ? <SavedReview review={shown} /> : null}
      <Button
        type="button"
        variant="outline"
        disabled={reviewing || !room || !chat.threadId}
        onClick={() => void handleReview()}
      >
        {reviewing ? "Reviewing…" : "Review with AI"}
      </Button>
    </div>
  );
}

function reviewFromMessage(message: AiThreadMessage): CourseReview | null {
  const recommendation = message.payload["recommendation"];
  const confidence = message.payload["confidence"];
  const summary = message.payload["summary"];
  const findings = message.payload["findings"];
  if (recommendation !== "recommend" && recommendation !== "revise") return null;
  if (typeof confidence !== "number" || typeof summary !== "string" || !Array.isArray(findings)) {
    return null;
  }
  return {
    id: message.id,
    courseId: "",
    recommendation,
    confidence,
    lowConfidence: message.payload["lowConfidence"] === true,
    summary,
    findings: findings.filter((item): item is string => typeof item === "string"),
    createdAt: "",
  };
}

function SavedReview({ review }: { review: CourseReview }) {
  return (
    <div className="space-y-2">
      <MetaList stacked>
        <MetaItem label="Recommendation" value={recommendationLabel(review.recommendation)} />
        <MetaItem label="Confidence" value={formatConfidence(review.confidence)} />
      </MetaList>
      {review.lowConfidence ? (
        <p className="text-sm font-medium text-foreground">Low confidence</p>
      ) : null}
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground [overflow-wrap:anywhere]">
        {review.summary}
      </p>
      {review.findings.length > 0 ? (
        <ul className="list-disc space-y-1 pl-5 text-sm text-foreground">
          {review.findings.map((finding, index) => (
            <li key={`${index}-${finding}`} className="[overflow-wrap:anywhere]">
              {finding}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
