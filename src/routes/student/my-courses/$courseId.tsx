import { createFileRoute, getRouteApi } from "@tanstack/react-router";

import { isStudentDetailSource } from "@/features/courses/course-details";
import { CourseLearningScreen } from "@/features/student/course-learning-screen";

const studentRoute = getRouteApi("/student");

export const Route = createFileRoute("/student/my-courses/$courseId")({
  validateSearch: (search: Record<string, unknown>) => ({
    from: isStudentDetailSource(search["from"]) ? search["from"] : "browse",
  }),
  component: CourseLearningPage,
});

function CourseLearningPage() {
  const { courseId } = Route.useParams();
  const { from } = Route.useSearch();
  const session = studentRoute.useRouteContext();
  if (session.status !== "ready") return null;
  return <CourseLearningScreen courseId={courseId} studentId={session.userId} from={from} />;
}
