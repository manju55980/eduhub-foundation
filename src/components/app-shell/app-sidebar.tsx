import { Link, useRouterState } from "@tanstack/react-router";
import {
  Award,
  BookOpen,
  ClipboardCheck,
  ClipboardList,
  FolderTree,
  GraduationCap,
  LayoutDashboard,
  Library,
  ListChecks,
  PenLine,
  Sparkles,
  Sprout,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { roleNavigation, type AppRole } from "@/lib/roles";

const navIcon: Record<string, LucideIcon> = {
  "/student/courses": Library,
  "/student/my-courses": BookOpen,
  "/student/assignments": ClipboardList,
  "/student/grades": Award,
  "/student/profile": User,
  "/instructor": LayoutDashboard,
  "/instructor/courses/new": PenLine,
  "/instructor/courses/generate": Sparkles,
  "/instructor/courses": BookOpen,
  "/instructor/submissions": ClipboardCheck,
  "/instructor/profile": User,
  "/admin": LayoutDashboard,
  "/admin/courses/approvals": ClipboardCheck,
  "/admin/users": Users,
  "/admin/categories": FolderTree,
  "/admin/enrollments": ListChecks,
  "/admin/reports": Award,
};

export function AppSidebar({ role }: { role: AppRole }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const items = roleNavigation[role];

  return (
    <Sidebar>
      <SidebarHeader className="px-4 py-5">
        <div className="flex items-center gap-2 text-base font-semibold text-foreground">
          <GraduationCap className="size-5 text-primary" />
          EduHub
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const Icon = navIcon[item.to];
                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton asChild isActive={isCurrentPath(pathname, item.to)}>
                      <Link to={item.to}>
                        {Icon ? <Icon /> : null}
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="px-4 py-5">
        <div className="flex items-start gap-2 text-xs leading-snug text-muted-foreground">
          <Sprout className="mt-0.5 size-4 shrink-0" />
          <p>Better learning builds brighter futures.</p>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

function isCurrentPath(pathname: string, to: string) {
  const current = pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  return current === to;
}
