export type LessonText = {
  title: string;
  content: string;
  videoUrl: string | null;
};

export function lessonDraft(
  title: string,
  content: string,
  videoUrl: string,
): { ok: true; lesson: LessonText } | { ok: false; message: string } {
  const trimmedTitle = title.trim();
  const trimmedContent = content.trim();
  const trimmedVideo = videoUrl.trim();
  const messages: string[] = [];

  if (!trimmedTitle) messages.push("Enter a lesson title.");
  if (!trimmedContent) messages.push("Enter lesson content.");
  if (messages.length > 0) return { ok: false, message: messages.join(" ") };

  return {
    ok: true,
    lesson: {
      title: trimmedTitle,
      content: trimmedContent,
      videoUrl: trimmedVideo ? trimmedVideo : null,
    },
  };
}

export function lessonInsert(courseId: string, lesson: LessonText, orderIndex: number) {
  return {
    course_id: courseId,
    title: lesson.title,
    content: lesson.content,
    video_url: lesson.videoUrl,
    order_index: orderIndex,
  };
}

export function lessonFieldUpdate(lesson: LessonText) {
  return {
    title: lesson.title,
    content: lesson.content,
    video_url: lesson.videoUrl,
  };
}

export function nextLessonOrder(orderIndexes: Array<number | null>) {
  let highest: number | null = null;
  for (const value of orderIndexes) {
    if (value == null || !Number.isFinite(value)) continue;
    if (highest == null || value > highest) highest = value;
  }
  return highest == null ? 1 : highest + 1;
}

export function compareLessons(
  a: { orderIndex: number | null; createdAt: string },
  b: { orderIndex: number | null; createdAt: string },
) {
  if (a.orderIndex == null && b.orderIndex != null) return 1;
  if (a.orderIndex != null && b.orderIndex == null) return -1;
  if (a.orderIndex != null && b.orderIndex != null && a.orderIndex !== b.orderIndex) {
    return a.orderIndex - b.orderIndex;
  }
  if (a.createdAt < b.createdAt) return -1;
  if (a.createdAt > b.createdAt) return 1;
  return 0;
}
