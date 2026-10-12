export const questionLimit = 1000;
export const notAvailableMessage = "This course is not available.";
export const studentOnlyMessage = "Only a student can use the study companion.";
export const noLessonContentMessage = "This course has no lesson content yet.";

const courseIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type StudyLesson = {
  title: string | null;
  content: string | null;
};

export function parseStudyRequest(
  body: unknown,
): { ok: true; courseId: string; question: string } | { ok: false; message: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, message: "The request was not valid." };
  }
  const courseId =
    "courseId" in body && typeof body.courseId === "string" ? body.courseId.trim() : "";
  const question =
    "question" in body && typeof body.question === "string" ? body.question.trim() : "";
  if (!courseIdPattern.test(courseId)) {
    return { ok: false, message: "This course is not available." };
  }
  if (!question) return { ok: false, message: "Enter a question." };
  if (question.length > questionLimit) {
    return { ok: false, message: "The question must be 1,000 characters or fewer." };
  }
  return { ok: true, courseId, question };
}

export function studyAccess(input: {
  role: string | null;
  courseFound: boolean;
  enrolled: boolean;
}) {
  if (input.role !== "student") return { ok: false as const, message: studentOnlyMessage };
  if (!input.courseFound || !input.enrolled) {
    return { ok: false as const, message: notAvailableMessage };
  }
  return { ok: true as const };
}

export function hasLessonContent(lessons: Array<{ content: string | null }>) {
  return lessons.some((lesson) => (lesson.content ?? "").trim().length > 0);
}

export function studyPrompt(input: {
  question: string;
  course: { title: string | null; description: string | null };
  lessons: StudyLesson[];
}) {
  const lessons = input.lessons
    .filter((lesson) => (lesson.content ?? "").trim().length > 0)
    .map((lesson, index) => {
      const title = (lesson.title ?? "").trim() || "Untitled lesson";
      return `${index + 1}. ${title}\n${(lesson.content ?? "").trim()}`;
    })
    .join("\n\n");

  return {
    system:
      'You help a student with one course. Use only the course title, description, and lesson text in the user message. Explain that text in simpler words, give one short example that illustrates it, and write three practice questions about it. Do not mention scores, submissions, other students, or other courses. Reply with JSON only: {"explanation": string, "example": string, "practiceQuestions": string[]}.',
    user: `Course title: ${(input.course.title ?? "").trim()}\nCourse description: ${(input.course.description ?? "").trim()}\n\nLessons:\n${lessons}\n\nQuestion: ${input.question}`,
  };
}

export function parseStudyReply(
  value: unknown,
):
  | { ok: true; explanation: string; example: string; practiceQuestions: string[] }
  | { ok: false; message: string } {
  if (!value || typeof value !== "object") {
    return { ok: false, message: "The AI response was not valid." };
  }
  const explanation =
    "explanation" in value && typeof value.explanation === "string" ? value.explanation.trim() : "";
  const example =
    "example" in value && typeof value.example === "string" ? value.example.trim() : "";
  const practice =
    "practiceQuestions" in value && Array.isArray(value.practiceQuestions)
      ? value.practiceQuestions
      : [];
  const practiceQuestions = practice
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .slice(0, 5);

  if (!explanation || !example || practiceQuestions.length === 0) {
    return { ok: false, message: "The AI response was not valid." };
  }

  return { ok: true, explanation, example, practiceQuestions };
}
