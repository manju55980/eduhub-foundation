import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { listCategories } from "@/features/categories/categories-api";

import { MyCoursesScreen } from "./my-courses-screen";
import {
  listInstructorCourses,
  submitCourseForApproval,
  updateCourseFields,
} from "./my-courses-api";

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
    <a href={to && params?.courseId ? to.replace("$courseId", params.courseId) : (to ?? "#")}>
      {children}
    </a>
  ),
}));

vi.mock("@/features/categories/categories-api", () => ({
  listCategories: vi.fn(),
}));

vi.mock("./my-courses-api", () => ({
  listInstructorCourses: vi.fn(),
  updateCourseFields: vi.fn(),
  submitCourseForApproval: vi.fn(),
}));

const listCourseCategories = vi.mocked(listCategories);
const listCourses = vi.mocked(listInstructorCourses);
const updateFields = vi.mocked(updateCourseFields);
const submitCourse = vi.mocked(submitCourseForApproval);

const draft = {
  id: "course-1",
  title: "Intro to React",
  description: "Basics",
  level: "beginner",
  categoryId: null,
  status: "draft",
  createdAt: "2026-10-10T00:00:00.000Z",
  lessonCount: 0,
};

describe("MyCoursesScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listCourseCategories.mockResolvedValue({ ok: true, categories: [] });
  });

  it("shows an empty list without sample courses", async () => {
    listCourses.mockResolvedValue({ ok: true, courses: [] });

    render(<MyCoursesScreen />);

    expect(
      await screen.findByRole("heading", { name: "My Courses (including lessons)" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create Course" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Submit for approval" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /delete/i })).not.toBeInTheDocument();
  });

  it("does not offer submit for a draft with no lessons", async () => {
    listCourses.mockResolvedValue({ ok: true, courses: [draft] });

    render(<MyCoursesScreen />);

    expect(await screen.findByRole("button", { name: "Save course" })).toBeInTheDocument();
    expect(screen.getByText("Add a lesson before submitting this course.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Lessons" })).toHaveAttribute(
      "href",
      "/instructor/courses/course-1/lessons",
    );
    expect(screen.getByRole("link", { name: "Assignments" })).toHaveAttribute(
      "href",
      "/instructor/courses/course-1/assignments",
    );
    expect(screen.queryByRole("button", { name: "Submit for approval" })).not.toBeInTheDocument();
    expect(submitCourse).not.toHaveBeenCalled();
  });

  it("submits only the pending status for a draft that has a lesson", async () => {
    listCourses.mockResolvedValue({ ok: true, courses: [{ ...draft, lessonCount: 1 }] });
    submitCourse.mockResolvedValue({ ok: true });

    render(<MyCoursesScreen />);

    fireEvent.click(await screen.findByRole("button", { name: "Submit for approval" }));

    await waitFor(() => expect(submitCourse).toHaveBeenCalledWith("course-1"));
    expect(updateFields).not.toHaveBeenCalled();
    expect(await screen.findByRole("status")).toHaveTextContent(
      "This course was submitted for approval.",
    );
    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save course" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Submit for approval" })).not.toBeInTheDocument();
  });

  it("leaves the draft in place when submit is rejected", async () => {
    listCourses.mockResolvedValue({ ok: true, courses: [{ ...draft, lessonCount: 1 }] });
    submitCourse.mockResolvedValue({
      ok: false,
      message: "instructors can only submit a draft course for approval",
    });

    render(<MyCoursesScreen />);

    fireEvent.click(await screen.findByRole("button", { name: "Submit for approval" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "instructors can only submit a draft course for approval",
    );
    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(screen.queryByText("Pending")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save course" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit for approval" })).toBeInTheDocument();
  });

  it("saves trimmed course fields without changing status", async () => {
    listCourses.mockResolvedValue({ ok: true, courses: [draft] });
    updateFields.mockResolvedValue({ ok: true });

    render(<MyCoursesScreen />);

    fireEvent.click(await screen.findByRole("button", { name: "Save course" }));

    await waitFor(() =>
      expect(updateFields).toHaveBeenCalledWith("course-1", {
        title: "Intro to React",
        description: "Basics",
        level: "beginner",
        categoryId: null,
      }),
    );
    expect(submitCourse).not.toHaveBeenCalled();
    expect(await screen.findByRole("status")).toHaveTextContent("Course changes were saved.");
    expect(screen.getByRole("button", { name: "Save course" })).toBeInTheDocument();
  });

  it("hides the draft editor when categories fail to load", async () => {
    listCourses.mockResolvedValue({ ok: true, courses: [draft] });
    listCourseCategories.mockResolvedValue({ ok: false, message: "Could not load categories." });

    render(<MyCoursesScreen />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load categories.");
    expect(screen.queryByRole("button", { name: "Save course" })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Category" })).not.toBeInTheDocument();
  });

  it("hides editing and status controls after a course leaves draft", async () => {
    listCourseCategories.mockResolvedValue({
      ok: true,
      categories: [{ id: "category-1", name: "Science", createdAt: "2026-10-01T00:00:00.000Z" }],
    });
    listCourses.mockResolvedValue({
      ok: true,
      courses: [{ ...draft, status: "published", categoryId: "category-1", lessonCount: 2 }],
    });

    render(<MyCoursesScreen />);

    expect(await screen.findByRole("heading", { name: "Intro to React" })).toBeInTheDocument();
    expect(screen.getByText("Published")).toBeInTheDocument();
    expect(screen.getByText("Science")).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Category" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save course" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Submit for approval" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /delete/i })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Lessons" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Assignments" })).toHaveAttribute(
      "href",
      "/instructor/courses/course-1/assignments",
    );
  });
});
