import { createFileRoute, Outlet } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell/app-shell";
import { requireRole } from "@/features/auth/require-role";
import { ProfileError } from "@/features/auth/session-screen";

export const Route = createFileRoute("/instructor")({
  beforeLoad: () => requireRole("instructor"),
  component: InstructorLayout,
});

function InstructorLayout() {
  const session = Route.useRouteContext();
  if (session.status === "profile-error") {
    return <ProfileError message={session.message} />;
  }
  return (
    <AppShell role="instructor" email={session.email} fullName={session.fullName}>
      <Outlet />
    </AppShell>
  );
}
