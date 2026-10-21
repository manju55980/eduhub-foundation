import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { roleNavigation } from "@/lib/roles";

import { AppSidebar } from "./app-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    children,
    className,
    onClick,
  }: {
    to: string;
    children: ReactNode;
    className?: string;
    onClick?: () => void;
  }) => (
    <a href={to} className={className} onClick={onClick}>
      {children}
    </a>
  ),
  useRouterState: ({
    select,
  }: {
    select: (state: { location: { pathname: string } }) => unknown;
  }) => select({ location: { pathname: "/instructor" } }),
}));

describe("narrow instructor and admin navigation", () => {
  it("shows every instructor and admin label without clipping the long course link", () => {
    const { unmount } = render(
      <SidebarProvider>
        <AppSidebar role="instructor" />
      </SidebarProvider>,
    );

    const courses = screen.getByRole("link", { name: "My Courses (including lessons)" });
    expect(courses.className).toContain("whitespace-normal");
    expect(courses.className).not.toContain("truncate");
    for (const item of roleNavigation.instructor) {
      expect(screen.getByRole("link", { name: item.label })).toBeInTheDocument();
    }
    unmount();

    render(
      <SidebarProvider>
        <AppSidebar role="admin" />
      </SidebarProvider>,
    );
    for (const item of roleNavigation.admin) {
      expect(screen.getByRole("link", { name: item.label })).toBeInTheDocument();
    }
  });
});
