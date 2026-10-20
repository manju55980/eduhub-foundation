import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MyCoursesScreen } from "./my-courses-screen";
import { listEnrolledCourses } from "./my-courses-api";
import { listCertificates } from "@/features/notifications/notifications-api";

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

vi.mock("@/features/notifications/notifications-api", () => ({
  listCertificates: vi.fn(),
  shownCertificate: (
    status: string,
    enrollmentId: string,
    certificates: Array<{ enrollmentId: string }>,
  ) =>
    status === "completed"
      ? (certificates.find((row) => row.enrollmentId === enrollmentId) ?? null)
      : null,
}));

const listCourses = vi.mocked(listEnrolledCourses);
const listCerts = vi.mocked(listCertificates);

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
    listCerts.mockResolvedValue({ ok: true, certificates: [] });
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
    expect(screen.getByText("Progress")).toBeInTheDocument();
    expect(screen.getByText("40%")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Archived")).toBeInTheDocument();
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

  it("replaces published with completed only when that enrollment is completed", async () => {
    listCourses.mockResolvedValue({
      ok: true,
      courses: [
        {
          ...course,
          id: "course-done",
          title: "Finished course",
          status: "published",
          enrollmentStatus: "completed",
        },
        { ...course, id: "course-open", title: "Open course", status: "published" },
      ],
    });

    render(<MyCoursesScreen studentId="student-1" />);

    expect(await screen.findByRole("heading", { name: "Finished course" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Open course" })).toBeInTheDocument();
    expect(screen.getAllByText("Completed")).toHaveLength(2);
    expect(screen.getByText("Published")).toBeInTheDocument();
  });

  it("does not offer open course when the list fails to load", async () => {
    listCourses.mockResolvedValue({ ok: false, message: "Could not load courses." });

    render(<MyCoursesScreen studentId="student-1" />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load courses.");
    expect(screen.queryByRole("link", { name: "Open course" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Browse Courses" })).not.toBeInTheDocument();
    expect(screen.queryByText("Archived course")).not.toBeInTheDocument();
  });

  it("shows the certificate only for a completed enrollment", async () => {
    listCerts.mockResolvedValue({
      ok: true,
      certificates: [
        {
          enrollmentId: "enrollment-1",
          courseId: "course-1",
          issuedAt: "2026-10-18T15:00:00.000Z",
        },
      ],
    });
    listCourses.mockResolvedValue({
      ok: true,
      courses: [{ ...course, enrollmentId: "enrollment-1", enrollmentStatus: "completed" }],
    });

    render(<MyCoursesScreen studentId="student-1" />);

    expect(await screen.findByText(/Certificate issued/)).toHaveTextContent("Archived course");
    expect(screen.getByText("Archived")).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.queryByText("Published")).not.toBeInTheDocument();
    expect(screen.queryByText("Assignment due soon")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mark read" })).not.toBeInTheDocument();
  });
});
