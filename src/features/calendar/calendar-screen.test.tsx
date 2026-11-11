import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { periodLabel, visibleRange } from "./calendar-model";
import { AcademicCalendar } from "./calendar-screen";
import { listCalendarEvents, saveClassSession, listCalendarCourses } from "./calendar-api";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    params,
  }: {
    children?: ReactNode;
    to: string;
    params?: { courseId?: string };
  }) => <a href={params?.courseId ? to.replace("$courseId", params.courseId) : to}>{children}</a>,
}));

vi.mock("./calendar-api", () => ({
  listCalendarEvents: vi.fn(),
  listCalendarCourses: vi.fn(),
  saveClassSession: vi.fn(),
}));

const listEvents = vi.mocked(listCalendarEvents);
const listCourses = vi.mocked(listCalendarCourses);
const saveSession = vi.mocked(saveClassSession);
const now = new Date(2026, 10, 11, 12, 0, 0);

const events = [
  {
    id: "session-1",
    kind: "class" as const,
    title: "Algebra seminar",
    courseId: "course-1",
    courseTitle: "Algebra",
    startsAt: new Date(2026, 10, 11, 9, 30).toISOString(),
    endsAt: new Date(2026, 10, 11, 10, 30).toISOString(),
    location: "Room 2",
  },
  {
    id: "assignment-1",
    kind: "deadline" as const,
    title: "Essay",
    courseId: "course-1",
    courseTitle: "Algebra",
    startsAt: new Date(2026, 10, 12, 17, 0).toISOString(),
    endsAt: null,
    location: null,
  },
];

describe("AcademicCalendar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the month, then the week and day, for a student", async () => {
    listEvents.mockResolvedValue({ ok: true, events });

    render(<AcademicCalendar role="student" now={now} />);

    expect(screen.getByText("Loading calendar…")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Calendar" })).toBeInTheDocument();
    expect(listEvents).toHaveBeenCalledWith(visibleRange(now, "month"));
    expect(screen.getByRole("button", { name: "Month" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(periodLabel(now, "month"))).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Month" }).className).toContain("grid-cols-7");

    const selected = await screen.findByRole("region", { name: "Selected day" });
    expect(within(selected).getByRole("link", { name: /Algebra seminar/ })).toHaveAttribute(
      "href",
      "/student/my-courses/course-1",
    );
    expect(within(selected).getByText("Class")).toBeInTheDocument();
    expect(within(selected).getByText(/Room 2/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add class" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Edit / })).not.toBeInTheDocument();
    expect(within(selected).queryByRole("link", { name: /Essay/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Thursday 12 November 2026" }));
    expect(within(selected).getByRole("link", { name: /Essay/ })).toHaveAttribute(
      "href",
      "/student/assignments",
    );
    expect(within(selected).getByText("Deadline")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Week" }));
    expect(screen.getByText(periodLabel(now, "week"))).toBeInTheDocument();
    const week = await screen.findByRole("group", { name: "Week" });
    expect(week.className).toContain("hidden");
    expect(week.className).toContain("md:grid");
    expect(screen.getByRole("group", { name: "Days" }).className).toContain("md:hidden");

    fireEvent.click(screen.getByRole("button", { name: "Day" }));
    await waitFor(() => {
      expect(screen.queryByText("Loading calendar…")).not.toBeInTheDocument();
    });
    expect(screen.getByText(periodLabel(new Date(2026, 10, 12), "day"))).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Month" })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Week" })).not.toBeInTheDocument();
  });

  it("links an instructor class and deadline to the course pages", async () => {
    listEvents.mockResolvedValue({ ok: true, events });

    render(<AcademicCalendar role="instructor" now={now} />);

    const selected = await screen.findByRole("region", { name: "Selected day" });
    expect(within(selected).getByRole("link", { name: /Algebra seminar/ })).toHaveAttribute(
      "href",
      "/instructor/courses/course-1",
    );
    fireEvent.click(screen.getByRole("button", { name: "Thursday 12 November 2026" }));
    expect(within(selected).getByRole("link", { name: /Essay/ })).toHaveAttribute(
      "href",
      "/instructor/courses/course-1/assignments",
    );
    expect(screen.queryByRole("button", { name: "Edit Essay" })).not.toBeInTheDocument();
  });

  it("creates a class and rejects an end time that is not later", async () => {
    listEvents.mockResolvedValue({ ok: true, events });
    listCourses.mockResolvedValue({
      ok: true,
      courses: [{ id: "course-1", title: "Algebra" }],
    });
    saveSession.mockResolvedValue({ ok: true });

    render(<AcademicCalendar role="instructor" now={now} />);

    fireEvent.click(await screen.findByRole("button", { name: "Add class" }));
    const dialog = await screen.findByRole("dialog", { name: "Add class" });
    expect(await within(dialog).findByRole("option", { name: "Algebra" })).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Save class" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Choose a course.");
    expect(saveSession).not.toHaveBeenCalled();

    fireEvent.change(within(dialog).getByLabelText("Course"), { target: { value: "course-1" } });
    fireEvent.change(within(dialog).getByLabelText("Title"), { target: { value: "  Lab  " } });
    const start = within(dialog).getByLabelText("Start");
    fireEvent.change(within(dialog).getByLabelText("End"), {
      target: { value: (start as HTMLInputElement).value },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save class" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "End time must be after the start time.",
    );
    expect(saveSession).not.toHaveBeenCalled();

    fireEvent.change(within(dialog).getByLabelText("End"), {
      target: { value: "2026-11-11T10:00" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save class" }));
    await waitFor(() => expect(saveSession).toHaveBeenCalledTimes(1));
    expect(saveSession).toHaveBeenCalledWith(
      null,
      expect.objectContaining({ courseId: "course-1", title: "Lab", location: null }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent("Class saved.");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("edits a class without offering a course change", async () => {
    listEvents.mockResolvedValue({ ok: true, events });
    listCourses.mockResolvedValue({
      ok: true,
      courses: [{ id: "course-1", title: "Algebra" }],
    });
    saveSession.mockResolvedValue({ ok: true });

    render(<AcademicCalendar role="instructor" now={now} />);

    fireEvent.click(await screen.findByRole("button", { name: "Edit Algebra seminar" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit class" });
    expect(await within(dialog).findByLabelText("Course")).toBeDisabled();
    expect(within(dialog).getByLabelText("Title")).toHaveValue("Algebra seminar");
    fireEvent.change(within(dialog).getByLabelText("Title"), { target: { value: "Review" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save class" }));

    await waitFor(() => expect(saveSession).toHaveBeenCalledTimes(1));
    expect(saveSession).toHaveBeenCalledWith(
      "session-1",
      expect.objectContaining({
        courseId: "course-1",
        title: "Review",
        location: "Room 2",
      }),
    );
  });

  it("shows an empty period and an error without the schedule", async () => {
    listEvents.mockResolvedValue({ ok: true, events: [] });
    const { unmount } = render(<AcademicCalendar role="student" now={now} />);

    expect(await screen.findByText("No classes or deadlines in this period.")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Selected day" })).not.toBeInTheDocument();
    unmount();

    listEvents.mockResolvedValue({ ok: false, message: "Could not load the calendar." });
    render(<AcademicCalendar role="student" now={now} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load the calendar.");
    expect(screen.queryByText("No classes or deadlines in this period.")).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Month" })).not.toBeInTheDocument();
  });
});
