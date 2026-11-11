import { createFileRoute, getRouteApi } from "@tanstack/react-router";

import { AcademicCalendar } from "@/features/calendar/calendar-screen";

const instructorRoute = getRouteApi("/instructor");

export const Route = createFileRoute("/instructor/calendar")({
  component: InstructorCalendarPage,
});

function InstructorCalendarPage() {
  const session = instructorRoute.useRouteContext();
  if (session.status !== "ready") return null;
  return <AcademicCalendar role="instructor" />;
}
