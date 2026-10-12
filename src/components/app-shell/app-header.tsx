import { User } from "lucide-react";

import { LogoutButton } from "@/features/auth/logout-button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import type { AppRole } from "@/lib/roles";

const roleLabel: Record<AppRole, string> = {
  student: "Student",
  instructor: "Instructor",
  admin: "Admin",
};

export function AppHeader({
  role,
  email,
  fullName,
}: {
  role: AppRole;
  email: string;
  fullName: string;
}) {
  const name = fullName || email || "Signed in";
  const detail = [email, roleLabel[role]].filter(Boolean).join(" · ");

  return (
    <header className="flex items-center gap-3 border-b bg-background px-4 py-3 md:px-6">
      <SidebarTrigger className="md:hidden" />
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-sm border border-border bg-card text-muted-foreground">
          <User className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{name}</p>
          <p className="truncate text-xs text-muted-foreground">{detail}</p>
        </div>
      </div>
      <LogoutButton />
    </header>
  );
}
