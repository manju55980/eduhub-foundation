import type { ReactNode } from "react";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import type { AppRole } from "@/lib/roles";

import { AppHeader } from "./app-header";
import { AppSidebar } from "./app-sidebar";

export function AppShell({
  role,
  email,
  fullName,
  children,
}: {
  role: AppRole;
  email: string;
  fullName: string;
  children: ReactNode;
}) {
  return (
    <SidebarProvider>
      <AppSidebar role={role} />
      <SidebarInset className="min-w-0">
        <AppHeader role={role} email={email} fullName={fullName} />
        <div className="w-full min-w-0 flex-1 p-4 md:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
