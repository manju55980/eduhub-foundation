import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CourseLessonsScreen } from "./course-lessons-screen";
import { createLesson, getOwnedCourse, listCourseLessons, updateLesson } from "./lessons-api";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children?: ReactNode; to?: string }) => (
    <a href={to ?? "#"}>{children}</a>
  ),
}));

vi.mock("./lessons-api", () => ({
  getOwnedCourse: vi.fn(),
  listCourseLessons: vi.fn(),
  createLesson: vi.fn(),
  updateLesson: vi.fn(),
}));

const getCourse = vi.mocked(getOwnedCourse);
const listLessons = vi.mocked(listCourseLessons);
const create = vi.mocked(createLesson);
const update = vi.mocked(updateLesson);

describe("CourseLessonsScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not show a lesson form when the course is not returned", async () => {
    getCourse.mockResolvedValue({ ok: true, course: null });
    listLessons.mockResolvedValue({ ok: true, lessons: [] });

    render(<CourseLessonsScreen courseId="missing" />);

    expect(await screen.findByText("This course is not available.")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "My Courses (including lessons)" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save lesson" })).not.toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
  });

  it("requires title and content and does not collect lesson order", async () => {
    getCourse.mockResolvedValue({ ok: true, course: { id: "course-1", title: "Intro to React" } });
    listLessons.mockResolvedValue({
      ok: true,
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
    });

    render(<CourseLessonsScreen courseId="course-1" />);

    expect(await screen.findByRole("heading", { name: "Intro to React" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Welcome" })).toBeInTheDocument();
    expect(screen.getByText("Start here.")).toBeInTheDocument();
    expect(screen.getByText("Order 1")).toBeInTheDocument();
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /delete/i })).not.toBeInTheDocument();

    const form = screen.getByRole("button", { name: "Save lesson" }).closest("form");
    fireEvent.submit(form!);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Enter a lesson title. Enter lesson content.",
    );
    expect(create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
  });
});
