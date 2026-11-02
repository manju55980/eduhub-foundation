import { useEffect, useRef, useState } from "react";

import { MetaItem, MetaList } from "@/components/app-shell/record-card";
import { Button } from "@/components/ui/button";
import { SaveNotice } from "@/features/instructor/save-notice";

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
  const [fresh, setFresh] = useState<CourseReview | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const active = useRef(true);
  const shown = fresh ?? review;

  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);

  async function handleReview() {
    if (reviewing) return;
    setReviewing(true);
    setSaved(false);
    setError("");
    const result = await requestCourseReview(courseId);
    if (!active.current) return;
    setReviewing(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setFresh(result.review);
    setSaved(true);
  }

  return (
    <div className="space-y-3 border-t border-border pt-3">
      <SaveNotice
        tone="admin"
        saved={saved}
        message={saved ? savedMessage : error}
        onDismiss={() => {
          setSaved(false);
          setError("");
        }}
      />
      {shown ? <SavedReview review={shown} /> : null}
      <Button
        type="button"
        variant="outline"
        disabled={reviewing}
        onClick={() => void handleReview()}
      >
        {reviewing ? "Reviewing…" : "Review with AI"}
      </Button>
    </div>
  );
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
