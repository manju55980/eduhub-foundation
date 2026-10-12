import { useState, type FormEvent } from "react";

import { ErrorState } from "@/components/app-shell/page-state";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { hasLessonContent, questionLimit } from "../../../supabase/functions/_shared/study.ts";

import { askStudyCompanion } from "./study-companion-api";

type StudyAnswer = {
  explanation: string;
  example: string;
  practiceQuestions: string[];
};

export function StudyCompanionCard({
  courseId,
  lessons,
}: {
  courseId: string;
  lessons: Array<{ content: string | null }>;
}) {
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState(false);
  const [answer, setAnswer] = useState<StudyAnswer | null>(null);
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    setPending(true);
    setMessage("");
    const result = await askStudyCompanion(courseId, question);
    setPending(false);

    if (!result.ok) {
      setAnswer(null);
      setMessage(result.message);
      return;
    }

    setAnswer({
      explanation: result.explanation,
      example: result.example,
      practiceQuestions: result.practiceQuestions,
    });
  }

  return (
    <section className="space-y-4 rounded-sm border border-border bg-card p-4 shadow-none">
      <div className="space-y-1">
        <h2 className="text-base font-medium text-foreground">Study Companion</h2>
        <p className="text-sm text-muted-foreground">
          Ask about this course. You will get an explanation, an example, and practice questions.
          Nothing is saved.
        </p>
      </div>

      {hasLessonContent(lessons) ? (
        <form className="space-y-3" onSubmit={handleSubmit}>
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
              disabled={pending}
            />
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "Asking…" : "Ask"}
          </Button>
        </form>
      ) : (
        <p className="text-sm text-muted-foreground">This course has no lesson content yet.</p>
      )}

      {message ? <ErrorState message={message} /> : null}
      {answer ? (
        <div className="space-y-3 border-t border-border pt-3">
          <StudyPart label="Explanation" value={answer.explanation} />
          <StudyPart label="Example" value={answer.example} />
          <div className="space-y-1">
            <h3 className="text-xs font-medium text-muted-foreground">Practice questions</h3>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-foreground">
              {answer.practiceQuestions.map((item, index) => (
                <li
                  key={`${index}-${item}`}
                  className="whitespace-pre-wrap [overflow-wrap:anywhere]"
                >
                  {item}
                </li>
              ))}
            </ol>
          </div>
          <Button type="button" variant="outline" onClick={() => setAnswer(null)}>
            Dismiss
          </Button>
        </div>
      ) : null}
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
