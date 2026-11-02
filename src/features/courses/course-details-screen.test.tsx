import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CourseDetailsScreen } from "./course-details-screen";
import { getCourseDetails } from "./course-details-api";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    search,
  }: {
    children?: ReactNode;
    to?: string;
    search?: { from?: string };
  }) => <a href={search?.from ? `${to ?? "#"}?from=${search.from}` : (to ?? "#")}>{children}</a>,
}));

vi.mock("./course-details-api", () => ({
  getCourseDetails: vi.fn(),
}));

const loadCourse = vi.mocked(getCourseDetails);

const course = {
  id: "course-1",
  title: "Algebra",
  description: "Numbers",
  level: "beginner",
  status: "published",
  categoryName: "Math",
  createdAt: "2026-01-01T00:00:00.000Z",
  instructorName: null,
  lessons: null,
  enrollment: {
    progress: 10,
    status: "active",
    enrolledAt: "2026-01-02T00:00:00.000Z",
  },
};

describe("CourseDetailsScreen student open course", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadCourse.mockResolvedValue({ ok: true, course });
  });

  it("copies the details page from value onto open course", async () => {
    render(
      <CourseDetailsScreen
        courseId="course-1"
        backTo="/student/my-courses"
        backLabel="My Courses"
        audience="student"
        studentId="student-1"
        learningFrom="my-courses"
      />,
    );

    expect(await screen.findByRole("link", { name: "Open course" })).toHaveAttribute(
      "href",
      "/student/my-courses/$courseId?from=my-courses",
    );
    expect(screen.queryByRole("heading", { name: "Lessons" })).not.toBeInTheDocument();
  });

  it("sends browse when the details page has no other source", async () => {
    render(
      <CourseDetailsScreen
        courseId="course-1"
        backTo="/student/courses"
        backLabel="Browse Courses"
        audience="student"
        studentId="student-1"
      />,
    );

    expect(await screen.findByRole("link", { name: "Open course" })).toHaveAttribute(
      "href",
      "/student/my-courses/$courseId?from=browse",
    );
  });
});
