import { createFileRoute, getRouteApi } from "@tanstack/react-router";

import { AcademicCalendar } from "@/features/calendar/calendar-screen";

const studentRoute = getRouteApi("/student");

export const Route = createFileRoute("/student/calendar")({
  component: StudentCalendarPage,
});

function StudentCalendarPage() {
  const session = studentRoute.useRouteContext();
  if (session.status !== "ready") return null;
  return <AcademicCalendar role="student" />;
}
