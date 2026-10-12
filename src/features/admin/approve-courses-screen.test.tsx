import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApproveCoursesScreen } from "./approve-courses-screen";
import { listPendingCourses, publishCourse } from "./approve-courses-api";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children?: ReactNode; to?: string }) => (
    <a href={to ?? "#"}>{children}</a>
  ),
}));

vi.mock("./approve-courses-api", () => ({
  listPendingCourses: vi.fn(),
  publishCourse: vi.fn(),
}));

const listCourses = vi.mocked(listPendingCourses);
const publish = vi.mocked(publishCourse);

const course = {
  id: "course-1",
  title: "Intro to React",
  description: "Basics",
  level: "beginner",
  instructorName: "Ada Lovelace",
  createdAt: "2026-10-10T00:00:00.000Z",
  lessons: [
    {
      id: "lesson-1",
      title: "Welcome",
      content: "Start here.",
      videoUrl: null,
      orderIndex: 1,
      createdAt: "2026-10-10T00:00:00.000Z",
    },
  ],
};

describe("ApproveCoursesScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows an empty list without an approve control", async () => {
    listCourses.mockResolvedValue({ ok: true, courses: [] });

    render(<ApproveCoursesScreen />);

    expect(await screen.findByRole("heading", { name: "Approve Courses" })).toBeInTheDocument();
    expect(screen.getByText("No courses are waiting for approval.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Archive a published course" })).toHaveAttribute(
      "href",
      "/admin/courses/archive",
    );
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Archive" })).not.toBeInTheDocument();
  });

  it("shows a pending course and its lessons without other status controls", async () => {
    listCourses.mockResolvedValue({ ok: true, courses: [course] });

    render(<ApproveCoursesScreen />);

    expect(await screen.findByRole("heading", { name: "Intro to React" })).toBeInTheDocument();
    expect(screen.getByText("Basics")).toBeInTheDocument();
    expect(screen.getByText("Beginner")).toBeInTheDocument();
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Welcome" })).toBeInTheDocument();
    expect(screen.getByText("Start here.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /archive|reject|delete|edit/i }),
    ).not.toBeInTheDocument();
  });

  it("publishes the course and removes it from the pending list", async () => {
    listCourses.mockResolvedValue({ ok: true, courses: [course] });
    publish.mockResolvedValue({ ok: true });

    render(<ApproveCoursesScreen />);

    fireEvent.click(await screen.findByRole("button", { name: "Approve" }));

    await waitFor(() => expect(publish).toHaveBeenCalledWith("course-1"));
    expect(await screen.findByRole("status")).toHaveTextContent("This course was published.");
    expect(screen.queryByRole("heading", { name: "Intro to React" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Approve Courses" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
  });

  it("leaves the course pending when publish fails", async () => {
    listCourses.mockResolvedValue({ ok: true, courses: [course] });
    publish.mockResolvedValue({ ok: false, message: "admins can change only course status" });

    render(<ApproveCoursesScreen />);

    fireEvent.click(await screen.findByRole("button", { name: "Approve" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "admins can change only course status",
    );
    expect(screen.getByRole("heading", { name: "Intro to React" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve" })).toBeInTheDocument();
  });

  it("does not offer approve when the list fails to load", async () => {
    listCourses.mockResolvedValue({ ok: false, message: "Could not load courses." });

    render(<ApproveCoursesScreen />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load courses.");
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
  });
});
