import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CourseCard } from "./course-card";
import { getCourseDetails } from "./course-details-api";
import { listCompletedLessonIds } from "@/features/notifications/notifications-api";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    params,
    search,
  }: {
    children?: ReactNode;
    to?: string;
    params?: { courseId?: string };
    search?: { from?: string };
  }) => (
    <a
      href={
        params?.courseId
          ? `${(to ?? "").replace("$courseId", params.courseId)}${search?.from ? `?from=${search.from}` : ""}`
          : (to ?? "#")
      }
    >
      {children}
    </a>
  ),
}));

vi.mock("./course-details-api", () => ({
  getCourseDetails: vi.fn(),
}));

vi.mock("@/features/notifications/notifications-api", () => ({
  listCompletedLessonIds: vi.fn(),
}));

const loadDetails = vi.mocked(getCourseDetails);
const loadCompletions = vi.mocked(listCompletedLessonIds);

describe("Course preview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("opens a scrollable dialog for an enrolled student and closes from the keyboard", async () => {
    render(
      <CourseCard
        role="student"
        from="my-courses"
        studentId="student-1"
        enrolled
        courseId="course-1"
        title="React Fundamentals"
        description="Build modern web applications with React."
        categoryName="Technical"
        level="beginner"
        progress={{ completed: 6, total: 10, percent: 60 }}
        lessons={[
          { id: "lesson-1", title: "Introduction to React", completed: true },
          { id: "lesson-2", title: "Components and Props", completed: false },
        ]}
        actions={<a href="/student/my-courses/course-1?from=my-courses">Continue Learning</a>}
        previewActions={
          <a href="/student/my-courses/course-1?from=my-courses">Continue Learning</a>
        }
      />,
    );

    expect(screen.getByRole("button", { name: "Quick preview" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Quick preview" }));

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveClass("overflow-y-auto");
    expect(screen.getAllByRole("heading", { name: "React Fundamentals" }).length).toBeGreaterThan(
      0,
    );
    expect(screen.getByText("Technical")).toBeInTheDocument();
    expect(screen.getByText("Beginner")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Overview" })).toBeInTheDocument();
    expect(screen.getAllByText("6 of 10 lessons complete").length).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("progressbar", { name: "6 of 10 lessons complete" })[0],
    ).toHaveAttribute("aria-valuenow", "60");
    expect(screen.getByText("Introduction to React · Completed")).toBeInTheDocument();
    expect(screen.getByText("Components and Props")).toBeInTheDocument();
    expect(screen.queryByText(/^By /)).not.toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: "Continue Learning" })).toHaveAttribute(
      "href",
      "/student/my-courses/course-1?from=my-courses",
    );
    expect(loadDetails).not.toHaveBeenCalled();

    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("offers Enroll and hides the lesson outline until the student joins", () => {
    render(
      <CourseCard
        role="student"
        from="browse"
        studentId="student-1"
        enrolled={false}
        courseId="course-2"
        title="Node.js Essentials"
        description="Learn Node.js from scratch."
        level="intermediate"
        lessons={[{ id: "lesson-9", title: "Hidden lesson" }]}
        actions={<button type="button">Enroll</button>}
        previewActions={<button type="button">Enroll</button>}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Quick preview" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Lessons are available after you enroll.")).toBeInTheDocument();
    expect(screen.queryByText("Hidden lesson")).not.toBeInTheDocument();
    expect(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Enroll" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close preview" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("loads the outline and shows instructor and management actions for an instructor", async () => {
    loadDetails.mockResolvedValue({
      ok: true,
      course: {
        id: "course-3",
        title: "Algebra",
        description: "Numbers and proofs.",
        level: "advanced",
        status: "draft",
        categoryName: "Science",
        createdAt: "2026-10-01T00:00:00.000Z",
        instructorName: "Grace Hopper",
        lessons: [
          {
            id: "lesson-3",
            title: "Proofs",
            content: "Start with axioms.",
            videoUrl: null,
            orderIndex: 1,
            createdAt: "2026-10-01T00:00:00.000Z",
          },
        ],
        enrollment: null,
      },
    });

    render(
      <CourseCard
        role="instructor"
        from="courses"
        courseId="course-3"
        title="Algebra"
        description="Numbers and proofs."
        level="advanced"
        previewActions={<a href="/instructor/courses/course-3/lessons">Lessons</a>}
        actions={<a href="/instructor/courses/course-3/lessons">Lessons</a>}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Quick preview" }));
    expect(await screen.findByText("By Grace Hopper")).toBeInTheDocument();
    expect(screen.getByText("Proofs")).toBeInTheDocument();
    expect(screen.getByText("Start with axioms.")).toBeInTheDocument();
    expect(screen.getByText("Science")).toBeInTheDocument();
    expect(
      within(screen.getByRole("dialog")).getByRole("link", { name: "Lessons" }),
    ).toHaveAttribute("href", "/instructor/courses/course-3/lessons");
    expect(loadDetails).toHaveBeenCalledWith("course-3", {
      includeLessons: true,
      includeInstructor: true,
    });
  });

  it("keeps an admin review action in the preview", async () => {
    loadCompletions.mockResolvedValue({ ok: true, lessonIds: [] });
    loadDetails.mockResolvedValue({
      ok: true,
      course: {
        id: "course-4",
        title: "Pending course",
        description: "Needs review.",
        level: "beginner",
        status: "pending",
        categoryName: "",
        createdAt: "2026-10-02T00:00:00.000Z",
        instructorName: "Ada Lovelace",
        lessons: [],
        enrollment: null,
      },
    });

    render(
      <CourseCard
        role="admin"
        from="approvals"
        courseId="course-4"
        title="Pending course"
        description="Needs review."
        instructorName="Ada Lovelace"
        actions={<button type="button">Approve</button>}
        previewActions={<button type="button">Approve</button>}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Quick preview" }));
    expect(await screen.findByText("By Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("This course has no lessons yet.")).toBeInTheDocument();
    expect(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Approve" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close preview" })).toBeInTheDocument();
  });
});
