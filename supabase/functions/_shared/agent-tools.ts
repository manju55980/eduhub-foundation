import { matchLatestPublished } from "./agent-team.ts";
import { notAvailableMessage } from "./study.ts";
import {
  courseIdFromArgs,
  lessonTextUnavailable,
  publishedCourseCountMessage,
  questionRequiredMessage,
  suggestNextCourse,
  type AgentCourseRef,
  type AgentToolName,
  type SuggestCourse,
  type SuggestEnrollment,
} from "./agent.ts";
import {
  defaultOllamaHost,
  embedTextsWithOllama,
  embeddingLiteral,
  type EmbeddingTask,
} from "./embeddings.ts";
import { failedAiMessage } from "./gemini.ts";
import { readToolArguments } from "./guardrails.ts";

export type AgentMatch = {
  id: string;
  sourceType: string | null;
  title: string | null;
  body: string | null;
  courseId: string | null;
  similarity: number | null;
};

export type AgentCourseDetail = {
  id: string;
  title: string | null;
  description: string | null;
  level: string | null;
  status: string | null;
  categoryId: string | null;
  createdAt: string;
};

export type AgentLesson = {
  title: string | null;
  content: string | null;
};

export type PublishedCourseListing = {
  id: string;
  title: string | null;
  createdAt: string;
  categoryName: string | null;
};

export type AgentGrade = {
  assignmentTitle: string | null;
  courseTitle: string | null;
  grade: string | null;
  feedback: string | null;
};

export type AgentReader = {
  userId: () => Promise<{ ok: true; userId: string } | { ok: false; message: string }>;
  role: (
    userId: string,
  ) => Promise<{ ok: true; role: string | null } | { ok: false; message: string }>;
  matchKnowledge: (
    queryEmbedding: string,
  ) => Promise<{ ok: true; matches: AgentMatch[] } | { ok: false; message: string }>;
  course: (
    courseId: string,
  ) => Promise<{ ok: true; course: AgentCourseDetail | null } | { ok: false; message: string }>;
  enrolled: (
    courseId: string,
    userId: string,
  ) => Promise<{ ok: true; enrolled: boolean } | { ok: false; message: string }>;
  lessons: (
    courseId: string,
  ) => Promise<{ ok: true; lessons: AgentLesson[] } | { ok: false; message: string }>;
  enrol: (
    userId: string,
    courseId: string,
  ) => Promise<
    { ok: true; title: string; courseId: string; already: boolean } | { ok: false; message: string }
  >;
  grades: (
    userId: string,
  ) => Promise<{ ok: true; grades: AgentGrade[] } | { ok: false; message: string }>;
  catalogue: (
    userId: string,
  ) => Promise<
    | { ok: true; enrollments: SuggestEnrollment[]; published: SuggestCourse[] }
    | { ok: false; message: string }
  >;
  publishedCount: () => Promise<{ ok: true; count: number } | { ok: false; message: string }>;
  latestPublished: () => Promise<
    { ok: true; courses: PublishedCourseListing[] } | { ok: false; message: string }
  >;
};

export type ToolRun = {
  name: AgentToolName;
  payload: Record<string, unknown>;
  courseIds: string[];
  enrolled: AgentCourseRef | null;
};

export async function runAgentTool(
  name: AgentToolName,
  args: Record<string, unknown>,
  context: {
    userId: string;
    enrolRequested: boolean;
    apiKey: string | undefined;
    ollamaHost?: string;
    fetchImpl: typeof fetch;
    reader: AgentReader;
    catalogueText?: string;
  },
): Promise<{ ok: true; run: ToolRun } | { ok: false; message: string }> {
  if (name === "search_catalogue") return searchCatalogue(args, context);
  if (name === "describe_course") return describeCourse(args, context);
  if (name === "enrol_in_course") return enrolInCourse(args, context);
  if (name === "fetch_my_grades") return fetchGrades(context);
  if (name === "count_published_courses") return countPublishedCourses(context);
  if (name === "latest_published_course") return latestPublishedCourse(args, context);
  return suggestCourse(context);
}

async function searchCatalogue(
  args: Record<string, unknown>,
  context: {
    apiKey: string | undefined;
    ollamaHost?: string;
    fetchImpl: typeof fetch;
    reader: AgentReader;
  },
): Promise<{ ok: true; run: ToolRun } | { ok: false; message: string }> {
  const query = readToolArguments(args, [{ key: "query", type: "text" }])["query"] ?? "";
  if (!query) {
    return {
      ok: true,
      run: toolRun("search_catalogue", { ok: false, message: questionRequiredMessage }, [], null),
    };
  }
  const embedded = await embedQuery(query, "RETRIEVAL_QUERY", context);
  if (!embedded.ok) return embedded;
  const matches = await context.reader.matchKnowledge(embeddingLiteral(embedded.values));
  if (!matches.ok) return { ok: false, message: failedAiMessage };
  const courseIds = matches.matches
    .map((match) => match.courseId)
    .filter((courseId): courseId is string => Boolean(courseId));
  return {
    ok: true,
    run: toolRun(
      "search_catalogue",
      {
        matches: matches.matches.map((match) => ({
          sourceType: match.sourceType,
          title: match.title,
          body: match.body,
          courseId: match.courseId,
          similarity: match.similarity,
        })),
      },
      courseIds,
      null,
    ),
  };
}

async function describeCourse(
  args: Record<string, unknown>,
  context: { userId: string; reader: AgentReader },
): Promise<{ ok: true; run: ToolRun } | { ok: false; message: string }> {
  const courseId = courseIdFromArgs(args);
  if (!courseId) {
    return {
      ok: true,
      run: toolRun("describe_course", { message: notAvailableMessage }, [], null),
    };
  }
  const course = await context.reader.course(courseId);
  if (!course.ok) return { ok: false, message: failedAiMessage };
  if (!course.course) {
    return {
      ok: true,
      run: toolRun("describe_course", { message: notAvailableMessage }, [], null),
    };
  }
  const enrolled = await context.reader.enrolled(courseId, context.userId);
  if (!enrolled.ok) return { ok: false, message: failedAiMessage };
  const lessons = enrolled.enrolled ? await context.reader.lessons(courseId) : null;
  if (lessons && !lessons.ok) return { ok: false, message: failedAiMessage };
  return {
    ok: true,
    run: toolRun(
      "describe_course",
      {
        id: course.course.id,
        title: course.course.title,
        description: course.course.description,
        level: course.course.level,
        lessons: lessons ? lessons.lessons : lessonTextUnavailable,
      },
      [course.course.id],
      null,
    ),
  };
}

export function matchPublishedTitle(
  courses: Array<{ id: string; title: string | null }>,
  query: string,
): { id: string; title: string } | { ambiguous: true; titles: string[] } | null {
  const needle = foldTitle(query);
  if (needle.length < 3) return null;
  const named = courses.flatMap((course) => {
    const title = course.title?.trim() ?? "";
    return title ? [{ id: course.id, title, folded: foldTitle(title) }] : [];
  });
  const exact = named.filter((course) => course.folded === needle);
  const exactMatch = oneTitle(exact);
  if (exactMatch) return exactMatch;
  if (exact.length > 1) return { ambiguous: true, titles: exact.map((course) => course.title) };
  const partial = named.filter(
    (course) => course.folded.includes(needle) || needle.includes(course.folded),
  );
  const partialMatch = oneTitle(partial);
  if (partialMatch) return partialMatch;
  if (partial.length > 1) return { ambiguous: true, titles: partial.map((course) => course.title) };
  return null;
}

function oneTitle(courses: Array<{ id: string; title: string }>) {
  const course = courses[0];
  if (courses.length !== 1 || !course) return null;
  return { id: course.id, title: course.title };
}

const severalCoursesMessage = "More than one course matches. Name one course.";

async function resolveEnrolCourse(
  args: Record<string, unknown>,
  reader: AgentReader,
): Promise<
  | { ok: true; courseId: string }
  | { ok: true; payload: Record<string, unknown> }
  | { ok: false; message: string }
> {
  const courseId = courseIdFromArgs(args);
  if (courseId) return { ok: true, courseId };
  const title =
    readToolArguments(args, [{ key: "title", type: "text" }])["title"] ||
    (typeof args["courseId"] === "string" ? args["courseId"].trim() : "");
  if (!title) return { ok: true, payload: { message: notAvailableMessage } };
  const listed = await reader.latestPublished();
  if (!listed.ok) return { ok: false, message: failedAiMessage };
  const match = matchPublishedTitle(listed.courses, title);
  if (!match) return { ok: true, payload: { message: notAvailableMessage } };
  if ("ambiguous" in match) {
    return {
      ok: true,
      payload: { message: severalCoursesMessage, courses: match.titles },
    };
  }
  return { ok: true, courseId: match.id };
}

function foldTitle(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function enrolInCourse(
  args: Record<string, unknown>,
  context: { userId: string; enrolRequested: boolean; reader: AgentReader },
): Promise<{ ok: true; run: ToolRun } | { ok: false; message: string }> {
  if (!context.enrolRequested) {
    return {
      ok: true,
      run: toolRun(
        "enrol_in_course",
        { ok: false, message: "Enrolment was not requested." },
        [],
        null,
      ),
    };
  }
  const resolved = await resolveEnrolCourse(args, context.reader);
  if (!resolved.ok) return resolved;
  if (!("courseId" in resolved)) {
    return {
      ok: true,
      run: toolRun("enrol_in_course", resolved.payload, [], null),
    };
  }
  const enrolled = await context.reader.enrol(context.userId, resolved.courseId);
  if (!enrolled.ok) {
    return {
      ok: true,
      run: toolRun("enrol_in_course", { message: enrolled.message }, [], null),
    };
  }
  const course = { id: enrolled.courseId, title: enrolled.title };
  return {
    ok: true,
    run: toolRun(
      "enrol_in_course",
      { ok: true, already: enrolled.already, courseId: enrolled.courseId, title: enrolled.title },
      [enrolled.courseId],
      course,
    ),
  };
}

async function fetchGrades(context: {
  userId: string;
  reader: AgentReader;
}): Promise<{ ok: true; run: ToolRun } | { ok: false; message: string }> {
  const grades = await context.reader.grades(context.userId);
  if (!grades.ok) return { ok: false, message: failedAiMessage };
  return { ok: true, run: toolRun("fetch_my_grades", { grades: grades.grades }, [], null) };
}

async function latestPublishedCourse(
  args: Record<string, unknown>,
  context: { reader: AgentReader; catalogueText?: string },
): Promise<{ ok: true; run: ToolRun } | { ok: false; message: string }> {
  const fields = readToolArguments(args, [
    { key: "category", type: "text" },
    { key: "query", type: "text" },
  ]);
  const listed = await context.reader.latestPublished();
  if (!listed.ok) return { ok: false, message: failedAiMessage };
  const categoryText = [fields["category"], fields["query"], context.catalogueText]
    .filter((value): value is string => Boolean(value))
    .join(" ");
  const courses = matchLatestPublished(listed.courses, categoryText).map((course) => ({
    id: course.id,
    title: course.title ?? "",
    createdAt: course.createdAt,
    category: course.categoryName,
  }));
  return {
    ok: true,
    run: toolRun(
      "latest_published_course",
      { courses },
      courses.map((course) => course.id),
      null,
    ),
  };
}

async function countPublishedCourses(context: {
  reader: AgentReader;
}): Promise<{ ok: true; run: ToolRun } | { ok: false; message: string }> {
  const counted = await context.reader.publishedCount();
  if (!counted.ok) return { ok: false, message: counted.message };
  return {
    ok: true,
    run: toolRun(
      "count_published_courses",
      { count: counted.count, message: publishedCourseCountMessage(counted.count) },
      [],
      null,
    ),
  };
}

async function suggestCourse(context: {
  userId: string;
  reader: AgentReader;
}): Promise<{ ok: true; run: ToolRun } | { ok: false; message: string }> {
  const catalogue = await context.reader.catalogue(context.userId);
  if (!catalogue.ok) return { ok: false, message: failedAiMessage };
  const course = suggestNextCourse({
    enrollments: catalogue.enrollments,
    published: catalogue.published,
  });
  return {
    ok: true,
    run: toolRun("suggest_next_course", { course }, course ? [course.id] : [], null),
  };
}

async function embedQuery(
  text: string,
  taskType: EmbeddingTask,
  context: { ollamaHost?: string; fetchImpl: typeof fetch },
) {
  const embedded = await embedTextsWithOllama(
    {
      host: context.ollamaHost ?? defaultOllamaHost,
      texts: [text],
      taskType,
      maxAttempts: 1,
    },
    context.fetchImpl,
  );
  if (!embedded.ok) return embedded;
  const values = embedded.vectors[0];
  if (!values) return { ok: false as const, message: failedAiMessage };
  return { ok: true as const, values };
}

function toolRun(
  name: AgentToolName,
  payload: Record<string, unknown>,
  courseIds: string[],
  enrolled: AgentCourseRef | null,
): ToolRun {
  return { name, payload, courseIds, enrolled };
}
