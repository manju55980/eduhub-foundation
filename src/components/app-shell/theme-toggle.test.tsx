import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SidebarProvider } from "@/components/ui/sidebar";
import type { AppRole } from "@/lib/roles";
import { themeStorageKey } from "@/lib/theme";

import { AppHeader } from "./app-header";

vi.mock("@/features/notifications/notification-bell", () => ({
  NotificationBell: () => (
    <button type="button" aria-label="Notifications">
      Notifications
    </button>
  ),
}));

vi.mock("@/features/auth/logout-button", () => ({
  LogoutButton: () => <button type="button">Log out</button>,
}));

afterEach(() => {
  cleanup();
  document.documentElement.classList.remove("dark");
  window.localStorage.clear();
});

function renderHeader(role: AppRole) {
  return render(
    <SidebarProvider>
      <AppHeader role={role} email="ada@example.com" fullName="Ada Lovelace" userId="user-1" />
    </SidebarProvider>,
  );
}

describe("theme toggle", () => {
  it("sits beside notifications for each signed-in role and remembers the choice", () => {
    for (const role of ["student", "instructor", "admin"] as const) {
      renderHeader(role);
      const theme = screen.getByRole("button", { name: "Switch to dark mode" });
      const notifications = screen.getByRole("button", { name: "Notifications" });
      expect(theme.getAttribute("aria-pressed")).toBe("false");
      expect(theme.compareDocumentPosition(notifications) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      );
      cleanup();
    }

    renderHeader("student");
    fireEvent.click(screen.getByRole("button", { name: "Switch to dark mode" }));

    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(window.localStorage.getItem(themeStorageKey)).toBe("dark");
    expect(screen.getByRole("button", { name: "Switch to light mode" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    cleanup();
    renderHeader("instructor");

    expect(screen.getByRole("button", { name: "Switch to light mode" })).toBeInTheDocument();
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Switch to light mode" }));
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(window.localStorage.getItem(themeStorageKey)).toBe("light");
  });
});
