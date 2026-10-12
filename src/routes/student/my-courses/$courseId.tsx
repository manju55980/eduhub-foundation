import { createFileRoute, getRouteApi } from "@tanstack/react-router";

import { CourseLearningScreen } from "@/features/student/course-learning-screen";

const studentRoute = getRouteApi("/student");

export const Route = createFileRoute("/student/my-courses/$courseId")({
  component: CourseLearningPage,
});

function CourseLearningPage() {
  const { courseId } = Route.useParams();
  const session = studentRoute.useRouteContext();
  if (session.status !== "ready") return null;
  return <CourseLearningScreen courseId={courseId} studentId={session.userId} />;
}
