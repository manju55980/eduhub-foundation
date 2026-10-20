import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NotificationBell } from "./notification-bell";
import { listNotifications, markNotificationRead } from "./notifications-api";

vi.mock("./notifications-api", () => ({
  listNotifications: vi.fn(),
  markNotificationRead: vi.fn(),
}));

const listNotes = vi.mocked(listNotifications);
const markRead = vi.mocked(markNotificationRead);

const unread = {
  id: "note-1",
  title: "Assignment due soon",
  body: "Essay is due soon in Algebra.",
  createdAt: "2026-10-18T12:00:00.000Z",
  readAt: null,
};

const read = {
  id: "note-2",
  title: "Course complete",
  body: "Algebra is complete.",
  createdAt: "2026-10-17T12:00:00.000Z",
  readAt: "2026-10-17T13:00:00.000Z",
};

describe("NotificationBell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listNotes.mockResolvedValue({ ok: true, notifications: [] });
    markRead.mockResolvedValue({ ok: true });
  });

  it("shows an empty list and no badge", async () => {
    render(<NotificationBell userId="student-1" role="student" />);

    fireEvent.click(screen.getByRole("button", { name: "Notifications" }));

    expect(await screen.findByText("No notifications.")).toBeInTheDocument();
    expect(screen.queryByText("1")).not.toBeInTheDocument();
  });

  it("lists recent rows and drops the unread count after mark read", async () => {
    listNotes.mockResolvedValue({ ok: true, notifications: [unread, read] });

    render(<NotificationBell userId="student-1" role="admin" />);

    expect(
      await screen.findByRole("button", { name: "Notifications, 1 unread" }),
    ).toHaveTextContent("1");
    fireEvent.click(screen.getByRole("button", { name: "Notifications, 1 unread" }));

    expect(await screen.findByText("Assignment due soon")).toBeInTheDocument();
    expect(screen.getByText("Essay is due soon in Algebra.")).toBeInTheDocument();
    expect(screen.getByLabelText("Unread")).toBeInTheDocument();
    expect(screen.getByText("Read")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Mark read" }));

    expect(await screen.findByText("Notification marked read.")).toBeInTheDocument();
    expect(markRead).toHaveBeenCalledWith("note-1", "student-1");
    expect(screen.getByRole("button", { name: "Notifications" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Unread")).not.toBeInTheDocument();
    expect(screen.getAllByText("Read").length).toBeGreaterThan(0);
  });

  it("keeps the unread count when mark read fails", async () => {
    listNotes.mockResolvedValue({ ok: true, notifications: [unread] });
    markRead.mockResolvedValue({ ok: false, message: "Could not mark the notification read." });

    render(<NotificationBell userId="instructor-1" role="instructor" />);

    fireEvent.click(await screen.findByRole("button", { name: "Notifications, 1 unread" }));
    fireEvent.click(await screen.findByRole("button", { name: "Mark read" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not mark the notification read.",
    );
    expect(screen.getByRole("button", { name: "Notifications, 1 unread" })).toBeInTheDocument();
    expect(screen.getByLabelText("Unread")).toBeInTheDocument();
  });
});
