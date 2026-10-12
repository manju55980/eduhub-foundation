import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MyCoursesScreen } from "./my-courses-screen";
import { listEnrolledCourses } from "./my-courses-api";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    params,
  }: {
    children?: ReactNode;
    to?: string;
    params?: { courseId?: string };
  }) => (
    <a href={params?.courseId ? `/student/my-courses/${params.courseId}` : (to ?? "#")}>
      {children}
    </a>
  ),
}));

vi.mock("./my-courses-api", () => ({
  listEnrolledCourses: vi.fn(),
}));

const listCourses = vi.mocked(listEnrolledCourses);

const course = {
  id: "course-1",
  title: "Archived course",
  description: "Still available",
  level: "advanced",
  status: "archived",
  createdAt: "2026-09-01T00:00:00.000Z",
  progress: 40,
  enrollmentStatus: "active",
  enrolledAt: "2026-10-10T00:00:00.000Z",
};

function formatCreatedAt(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

describe("MyCoursesScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows an empty list without an open-course control", async () => {
    listCourses.mockResolvedValue({ ok: true, courses: [] });

    render(<MyCoursesScreen studentId="student-1" />);

    expect(screen.getByText("Loading courses…")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Open course" })).not.toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "My Courses" })).toBeInTheDocument();
    expect(screen.getByText("You are not enrolled in any courses.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse Courses" })).toHaveAttribute(
      "href",
      "/student/courses",
    );
    expect(screen.queryByRole("link", { name: "Open course" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Enroll" })).not.toBeInTheDocument();
  });

  it("shows an enrolled course and links to the learning view", async () => {
    listCourses.mockResolvedValue({ ok: true, courses: [course] });

    render(<MyCoursesScreen studentId="student-1" />);

    expect(await screen.findByRole("heading", { name: "Archived course" })).toBeInTheDocument();
    expect(screen.getByText("Still available")).toBeInTheDocument();
    expect(screen.getByText("Advanced")).toBeInTheDocument();
    expect(screen.getByText("Archived")).toBeInTheDocument();
    expect(screen.getByText(formatCreatedAt(course.createdAt))).toBeInTheDocument();
    expect(screen.queryByText("Progress")).not.toBeInTheDocument();
    expect(screen.queryByText("40%")).not.toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText(formatCreatedAt(course.enrolledAt))).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open course" })).toHaveAttribute(
      "href",
      "/student/my-courses/course-1",
    );
    expect(screen.queryByRole("button", { name: "Enroll" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /unenroll|delete/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.queryByText(/instructor/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/lesson/i)).not.toBeInTheDocument();
  });

  it("does not offer open course when the list fails to load", async () => {
    listCourses.mockResolvedValue({ ok: false, message: "Could not load courses." });

    render(<MyCoursesScreen studentId="student-1" />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load courses.");
    expect(screen.queryByRole("link", { name: "Open course" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Browse Courses" })).not.toBeInTheDocument();
    expect(screen.queryByText("Archived course")).not.toBeInTheDocument();
  });
});
