import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

import { AppSidebar } from "./app-sidebar";

const route = vi.hoisted(() => ({ pathname: "/instructor" }));

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    children,
    onClick,
    ...props
  }: {
    to: string;
    children: ReactNode;
    onClick?: (event: { preventDefault: () => void }) => void;
  } & Record<string, unknown>) => (
    <a
      href={to}
      {...props}
      onClick={(event) => {
        event.preventDefault();
        onClick?.(event);
      }}
    >
      {children}
    </a>
  ),
  useRouterState: ({
    select,
  }: {
    select: (state: { location: { pathname: string } }) => unknown;
  }) => select({ location: { pathname: route.pathname } }),
}));

afterEach(() => {
  cleanup();
  route.pathname = "/instructor";
  window.innerWidth = 1024;
});

function renderSidebar(role: "student" | "instructor" | "admin") {
  return render(
    <SidebarProvider>
      <SidebarTrigger />
      <AppSidebar role={role} />
    </SidebarProvider>,
  );
}

function expectActive(name: string) {
  expect(screen.getByRole("link", { name })).toHaveAttribute("data-active", "true");
}

function expectInactive(name: string) {
  expect(screen.getByRole("link", { name })).toHaveAttribute("data-active", "false");
}

describe("sidebar active routes", () => {
  it("selects the longest matching item and keeps dashboard roots exact", () => {
    const cases: Array<{
      role: "student" | "instructor" | "admin";
      path: string;
      active: string;
      inactive: string[];
    }> = [
      {
        role: "instructor",
        path: "/instructor",
        active: "Instructor Dashboard",
        inactive: ["My Courses", "Create Course"],
      },
      {
        role: "instructor",
        path: "/instructor/courses/new",
        active: "Create Course",
        inactive: ["My Courses", "Instructor Dashboard"],
      },
      {
        role: "instructor",
        path: "/instructor/courses/course-1",
        active: "My Courses",
        inactive: ["Create Course", "AI Course Builder"],
      },
      {
        role: "instructor",
        path: "/instructor/courses/course-1/lessons",
        active: "My Courses",
        inactive: ["Create Course", "Submissions"],
      },
      {
        role: "admin",
        path: "/admin",
        active: "Admin Dashboard",
        inactive: ["Manage Courses"],
      },
      {
        role: "admin",
        path: "/admin/courses/approvals",
        active: "Manage Courses",
        inactive: ["Admin Dashboard"],
      },
      {
        role: "admin",
        path: "/admin/courses/archive",
        active: "Manage Courses",
        inactive: ["Admin Dashboard", "Reports"],
      },
      {
        role: "student",
        path: "/student/courses/course-1",
        active: "Browse Courses",
        inactive: ["My Courses"],
      },
      {
        role: "student",
        path: "/student/my-courses/course-1",
        active: "My Courses",
        inactive: ["Browse Courses", "Learning Assistant"],
      },
    ];

    for (const item of cases) {
      route.pathname = item.path;
      renderSidebar(item.role);
      expectActive(item.active);
      for (const name of item.inactive) expectInactive(name);
      cleanup();
    }
  });

  it("keeps a visible focus ring on each navigation link", () => {
    renderSidebar("student");
    const menu = screen.getByText("Menu");
    expect(menu.className).toContain("text-muted-foreground");
    expect(menu.className).not.toContain("text-sidebar-foreground/70");
    for (const link of screen.getAllByRole("link")) {
      expect(link.className).toContain("focus-visible:ring-2");
      expect(link.className).toContain("focus-visible:ring-offset-2");
    }
  });

  it("uses the overlay below md and closes it after a choice", async () => {
    window.innerWidth = 390;
    renderSidebar("instructor");

    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    const dialog = await screen.findByRole("dialog", { name: "Sidebar" });
    expect(dialog).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: "My Courses" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Sidebar" })).not.toBeInTheDocument();
    });
  });
});

describe("mobile sidebar accessibility", () => {
  it("names the toggle for the action it will take", () => {
    window.innerWidth = 390;
    renderSidebar("student");

    const toggle = screen.getByRole("button", { name: "Open menu" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button", { name: "Toggle Sidebar" })).not.toBeInTheDocument();
  });

  it("shows a focusable close control and still closes from Escape", async () => {
    window.innerWidth = 390;
    renderSidebar("instructor");

    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    const dialog = await screen.findByRole("dialog", { name: "Sidebar" });
    const close = within(dialog).getByRole("button", { name: "Close menu" });

    expect(close).toBeVisible();
    expect(close).not.toHaveAttribute("tabindex", "-1");
    expect(close.className).toContain("focus-visible:ring-2");
    close.focus();
    expect(close).toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Sidebar" })).not.toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Open menu" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("closes from the visible close control without changing the selected route", async () => {
    window.innerWidth = 390;
    route.pathname = "/instructor/courses";
    renderSidebar("instructor");

    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    const dialog = await screen.findByRole("dialog", { name: "Sidebar" });
    expect(within(dialog).getByRole("link", { name: "My Courses" })).toHaveAttribute(
      "data-active",
      "true",
    );

    fireEvent.click(within(dialog).getByRole("button", { name: "Close menu" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Sidebar" })).not.toBeInTheDocument();
    });
    expect(route.pathname).toBe("/instructor/courses");
    expect(screen.getByRole("button", { name: "Open menu" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });
});
