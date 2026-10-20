import { supabase } from "@/integrations/supabase/client";

import { readFunctionResult } from "@/features/ai/function-result";
import {
  parseBuilderRequest,
  parseCoursePreview,
} from "../../../supabase/functions/_shared/course-preview.ts";

import {
  startGeneratedSave,
  type CourseWriter,
  type SaveGeneratedResult,
} from "./course-builder-save";

export async function generateCoursePreview(input: {
  brief: string;
  level: string;
  lessonCount: string;
  assignmentCount: string;
  difficulty: string;
  goals: string;
  projects: string;
  resources: string;
}) {
  const parsed = parseBuilderRequest(input);
  if (!parsed.ok) return parsed;

  const { data, error } = await supabase.functions.invoke("ai-course-builder", {
    body: {
      brief: parsed.brief,
      level: parsed.level,
      lessonCount: parsed.lessonCount,
      assignmentCount: parsed.assignmentCount,
      difficulty: parsed.difficulty,
      goals: parsed.goals,
      projects: parsed.projects,
      resources: parsed.resources,
    },
  });
  const result = await readFunctionResult(data, error);
  if (!result.ok) return result;
  if (!result.value || typeof result.value !== "object" || !("preview" in result.value)) {
    return { ok: false as const, message: "The AI response was not valid." };
  }
  const preview = parseCoursePreview(result.value.preview, {
    lessons: parsed.lessonCount,
    assignments: parsed.assignmentCount,
  });
  if (!preview.ok) return preview;
  return {
    ok: true as const,
    preview: preview.preview,
    videos: learningVideosFrom(result.value),
    videoMessage: videoMessageFrom(result.value),
  };
}

function learningVideosFrom(value: object) {
  if (!("videos" in value) || !Array.isArray(value.videos)) return [];
  return value.videos.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const title = textValue(item, "title");
    const channel = textValue(item, "channel");
    const description = textValue(item, "description");
    const url = textValue(item, "url");
    if (
      !title ||
      !channel ||
      !/^https:\/\/www\.youtube\.com\/watch\?v=[A-Za-z0-9_-]{6,20}$/.test(url)
    ) {
      return [];
    }
    return [{ title, channel, description, url }];
  });
}

function videoMessageFrom(value: object) {
  if (!("videoMessage" in value) || typeof value.videoMessage !== "string") return "";
  const message = value.videoMessage.trim();
  if (!message || /AIza|key=/i.test(message)) return "";
  return message;
}

function textValue(value: object, key: string) {
  if (!(key in value)) return "";
  const field = (value as Record<string, unknown>)[key];
  return typeof field === "string" ? field.trim() : "";
}

export async function saveGeneratedCourse(
  input: {
    instructorId: string;
    title: string;
    description: string;
    level: string;
    categoryId: string;
    categoryIds: string[];
    lessons: Array<{ title: string; content: string; videoUrl?: string }>;
    assignments: Array<{ title: string; description: string; dueDate?: string }>;
    now?: Date;
  },
  writer: CourseWriter = supabaseCourseWriter,
): Promise<SaveGeneratedResult> {
  return startGeneratedSave(input, writer);
}

const supabaseCourseWriter: CourseWriter = {
  async insertCourse(row) {
    const { data, error } = await supabase.from("courses").insert(row).select("id, title").single();
    if (error) return { ok: false, message: error.message };
    return { ok: true, course: { id: data.id, title: data.title ?? "" } };
  },
  async insertLesson(row) {
    const { error } = await supabase.from("lessons").insert(row);
    if (error) return { ok: false, message: error.message };
    return { ok: true };
  },
  async insertAssignment(row) {
    const { error } = await supabase.from("assignments").insert(row);
    if (error) return { ok: false, message: error.message };
    return { ok: true };
  },
};
