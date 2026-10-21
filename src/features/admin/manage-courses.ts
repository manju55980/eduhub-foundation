import { compareCoursesNewestFirst } from "@/features/instructor/course-update";

import type { PendingLesson } from "./approve-courses-api";

export const adminCourseFilters = ["all", "pending", "published", "draft", "archived"] as const;
export const adminCourseSorts = ["newest", "oldest"] as const;

export type AdminCourseFilter = (typeof adminCourseFilters)[number];
export type AdminCourseSort = (typeof adminCourseSorts)[number];

export type AdminCourse = {
  id: string;
  title: string | null;
  description: string | null;
  level: string;
  status: string;
  instructorName: string | null;
  createdAt: string;
  lessons: PendingLesson[];
};

export type AdminCourseCounts = Record<AdminCourseFilter, number>;

export function countAdminCourses(courses: Pick<AdminCourse, "status">[]): AdminCourseCounts {
  return {
    all: courses.length,
    pending: courses.filter((course) => course.status === "pending").length,
    published: courses.filter((course) => course.status === "published").length,
    draft: courses.filter((course) => course.status === "draft").length,
    archived: courses.filter((course) => course.status === "archived").length,
  };
}

export function filterAdminCourses(
  courses: AdminCourse[],
  filter: AdminCourseFilter,
  query: string,
) {
  const needle = query.trim().toLowerCase();
  return courses.filter((course) => {
    if (filter !== "all" && course.status !== filter) return false;
    if (!needle) return true;
    const title = course.title?.toLowerCase() ?? "";
    const instructor = course.instructorName?.toLowerCase() ?? "";
    return title.includes(needle) || instructor.includes(needle);
  });
}

export function sortAdminCourses(courses: AdminCourse[], sort: AdminCourseSort) {
  const newest = [...courses].sort(compareCoursesNewestFirst);
  return sort === "oldest" ? newest.reverse() : newest;
}

export function adminCourseEmptyMessage(filter: AdminCourseFilter, query: string) {
  if (query.trim()) return "No courses match this search.";
  if (filter === "pending") return "No courses are waiting for approval.";
  if (filter === "published") return "No published courses are available to archive.";
  if (filter === "draft") return "There are no draft courses.";
  if (filter === "archived") return "There are no archived courses.";
  return "There are no courses yet.";
}
