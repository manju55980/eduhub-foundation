export const studentDetailSources = ["browse", "my-courses", "assistant"] as const;
export const instructorDetailSources = ["courses", "dashboard", "builder"] as const;
export const adminDetailSources = [
  "approvals",
  "archive",
  "dashboard",
  "enrollments",
  "reports",
] as const;

export type StudentDetailSource = (typeof studentDetailSources)[number];
export type InstructorDetailSource = (typeof instructorDetailSources)[number];
export type AdminDetailSource = (typeof adminDetailSources)[number];

export type CourseDetailLesson = {
  id: string;
  title: string | null;
  content: string | null;
  videoUrl: string | null;
  orderIndex: number | null;
  createdAt: string;
};

export type CourseEnrollmentDetail = {
  progress: number;
  status: string;
  enrolledAt: string;
};

export type CourseDetail = {
  id: string;
  title: string | null;
  description: string | null;
  level: string;
  status: string;
  categoryName: string;
  createdAt: string;
  instructorName: string | null;
  lessons: CourseDetailLesson[] | null;
  enrollment: CourseEnrollmentDetail | null;
};

const levelLabels: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

export function courseLevelLabel(level: string) {
  return levelLabels[level] ?? level;
}

export function formatCourseDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

export function isStudentDetailSource(value: unknown): value is StudentDetailSource {
  return studentDetailSources.some((source) => source === value);
}

export function isInstructorDetailSource(value: unknown): value is InstructorDetailSource {
  return instructorDetailSources.some((source) => source === value);
}

export function isAdminDetailSource(value: unknown): value is AdminDetailSource {
  return adminDetailSources.some((source) => source === value);
}

export function studentDetailReturn(source: StudentDetailSource) {
  if (source === "my-courses") return { to: "/student/my-courses" as const, label: "My Courses" };
  if (source === "assistant")
    return { to: "/student/assistant" as const, label: "Learning Assistant" };
  return { to: "/student/courses" as const, label: "Browse Courses" };
}

export function instructorDetailReturn(source: InstructorDetailSource) {
  if (source === "dashboard")
    return { to: "/instructor" as const, label: "Instructor Dashboard" };
  if (source === "builder")
    return { to: "/instructor/courses/generate" as const, label: "AI Course Builder" };
  return { to: "/instructor/courses" as const, label: "My Courses (including lessons)" };
}

export function adminDetailReturn(source: AdminDetailSource) {
  if (source === "archive")
    return { to: "/admin/courses/archive" as const, label: "Archive Courses" };
  if (source === "dashboard") return { to: "/admin" as const, label: "Admin Dashboard" };
  if (source === "enrollments")
    return { to: "/admin/enrollments" as const, label: "All Enrollments" };
  if (source === "reports") return { to: "/admin/reports" as const, label: "Reports" };
  return { to: "/admin/courses/approvals" as const, label: "Approve Courses" };
}

export function toCourseDetail(input: {
  id: string;
  title: string | null;
  description: string | null;
  level: string;
  status: string;
  categoryName: string;
  createdAt: string;
  instructorName?: string | null;
  lessons?: CourseDetailLesson[] | null;
  enrollment?: CourseEnrollmentDetail | null;
}): CourseDetail {
  return {
    id: input.id,
    title: input.title,
    description: input.description,
    level: input.level,
    status: input.status,
    categoryName: input.categoryName,
    createdAt: input.createdAt,
    instructorName: input.instructorName ?? null,
    lessons: input.lessons === undefined ? null : input.lessons,
    enrollment: input.enrollment ?? null,
  };
}

export function statusShownToStudent(courseStatus: string, enrollmentStatus?: string | null) {
  if (courseStatus === "published" && enrollmentStatus === "completed") return "completed";
  return courseStatus;
}
