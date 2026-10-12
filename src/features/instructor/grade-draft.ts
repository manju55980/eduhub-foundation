export type GradeText = {
  grade: string;
  feedback: string | null;
};

export function gradeDraft(
  grade: string,
  feedback: string,
): { ok: true; grade: GradeText } | { ok: false; message: string } {
  const trimmedGrade = grade.trim();
  const trimmedFeedback = feedback.trim();
  if (!trimmedGrade) return { ok: false, message: "Enter a grade." };

  return {
    ok: true,
    grade: {
      grade: trimmedGrade,
      feedback: trimmedFeedback ? trimmedFeedback : null,
    },
  };
}

export function gradeUpdate(grade: GradeText) {
  return {
    grade: grade.grade,
    feedback: grade.feedback,
    status: "graded" as const,
  };
}
