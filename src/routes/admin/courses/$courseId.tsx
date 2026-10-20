import { createFileRoute, getRouteApi } from "@tanstack/react-router";

import { adminDetailReturn, isAdminDetailSource } from "@/features/courses/course-details";
import { CourseDetailsScreen } from "@/features/courses/course-details-screen";

const adminRoute = getRouteApi("/admin");

export const Route = createFileRoute("/admin/courses/$courseId")({
  validateSearch: (search: Record<string, unknown>) => ({
    from: isAdminDetailSource(search.from) ? search.from : "approvals",
  }),
  component: AdminCourseDetailsPage,
});

function AdminCourseDetailsPage() {
  const { courseId } = Route.useParams();
  const { from } = Route.useSearch();
  const session = adminRoute.useRouteContext();
  if (session.status !== "ready") return null;
  const back = adminDetailReturn(from);
  return (
    <CourseDetailsScreen
      courseId={courseId}
      backTo={back.to}
      backLabel={back.label}
      audience="admin"
    />
  );
}
