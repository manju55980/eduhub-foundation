export const faqChunkCount = 5000;

const topics = [
  "note taking",
  "spaced repetition",
  "practice questions",
  "reading a lesson",
  "summarising a chapter",
  "asking for help",
  "reviewing feedback",
  "planning study time",
  "setting a learning goal",
  "checking understanding",
  "using examples",
  "comparing two ideas",
  "defining a term",
  "following a worked example",
  "spotting a mistake",
  "revising before a deadline",
  "breaking a topic into parts",
  "linking a lesson to an assignment",
  "choosing a beginner course",
  "choosing an intermediate course",
  "choosing an advanced course",
  "reading a course description",
  "finishing a lesson",
  "tracking progress",
  "joining a published course",
  "reading a grade",
  "using written feedback",
  "preparing a submission",
  "meeting a due date",
  "returning after a break",
  "studying in short sessions",
  "restating a concept",
  "teaching an idea aloud",
  "making a question list",
  "reviewing yesterday's notes",
  "finding the main point",
  "ignoring unrelated detail",
  "applying a rule",
  "checking units and terms",
  "reading instructions twice",
  "starting with the easiest step",
  "writing a one-sentence summary",
  "comparing a new idea with a known one",
  "listing what is still unclear",
  "using a glossary",
  "revising only the weak parts",
  "keeping a mistake log",
  "explaining why an answer is wrong",
  "choosing the next course",
  "reading a catalogue recommendation",
];

const angles = [
  "what it means",
  "how to practice it",
  "a common mistake",
  "a short example",
  "when to use it",
  "how to review it",
  "how it connects to a lesson",
  "how it helps an assignment",
  "what to do first",
  "how to tell it is working",
];

const audiences = [
  "a new learner",
  "someone returning after a break",
  "a learner preparing an assignment",
  "a learner reading feedback",
  "a learner choosing a course",
  "a learner who missed a lesson",
  "a learner with a due date",
  "a learner comparing two courses",
  "a learner who wants the next course",
  "a learner checking their progress",
];

export type RagChunkDraft = {
  sourceType: "course" | "lesson" | "faq";
  sourceKey: string;
  courseId: string | null;
  lessonId: string | null;
  title: string;
  body: string;
};

export function faqSourceKey(sequence: number) {
  return `faq:${String(sequence).padStart(4, "0")}`;
}

export function faqChunks(): RagChunkDraft[] {
  const chunks: RagChunkDraft[] = [];
  for (let sequence = 1; sequence <= faqChunkCount; sequence += 1) {
    const topic = topics[(sequence - 1) % topics.length] ?? "studying";
    const promptIndex = Math.floor((sequence - 1) / topics.length);
    const angle = angles[promptIndex % angles.length] ?? "what it means";
    const audience = audiences[Math.floor(promptIndex / angles.length)] ?? "a new learner";
    const sourceKey = faqSourceKey(sequence);
    const title = `How does ${topic} help ${audience} with ${angle}?`;
    chunks.push({
      sourceType: "faq",
      sourceKey,
      courseId: null,
      lessonId: null,
      title,
      body: `${title}\n${capitalize(topic)} helps ${audience} focus on ${angle}. Keep the answer tied to the lesson or course description, then review it once. ${sourceKey}.`,
    });
  }
  return chunks;
}

export function courseChunk(course: {
  id: string;
  title: string | null;
  description: string | null;
}): RagChunkDraft {
  const title = course.title?.trim() || "Untitled course";
  const description = course.description?.trim() || "";
  return {
    sourceType: "course",
    sourceKey: `course:${course.id}`,
    courseId: course.id,
    lessonId: null,
    title,
    body: description ? `${title}\n${description}` : title,
  };
}

export function lessonChunk(lesson: {
  id: string;
  courseId: string;
  title: string | null;
  content: string | null;
}): RagChunkDraft {
  const title = lesson.title?.trim() || "Untitled lesson";
  const content = lesson.content?.trim() || "";
  return {
    sourceType: "lesson",
    sourceKey: `lesson:${lesson.id}`,
    courseId: lesson.courseId,
    lessonId: lesson.id,
    title,
    body: content ? `${title}\n${content}` : title,
  };
}

export function planChunkWrites(existing: RagChunkDraft[], next: RagChunkDraft[]) {
  const current = new Map(existing.map((chunk) => [chunk.sourceKey, chunk]));
  return next.filter((chunk) => {
    const stored = current.get(chunk.sourceKey);
    return !stored || stored.title !== chunk.title || stored.body !== chunk.body;
  });
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
