import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { listCategories } from "@/features/categories/categories-api";

import { CreatedCoursePanel, CourseBuilderScreen } from "./course-builder-screen";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    params,
  }: {
    children?: ReactNode;
    to: string;
    params?: { courseId?: string };
  }) => <a href={to.replace("$courseId", params?.courseId ?? "")}>{children}</a>,
}));

vi.mock("@/features/categories/categories-api", () => ({
  listCategories: vi.fn(),
}));

const listCourseCategories = vi.mocked(listCategories);

describe("CreatedCoursePanel", () => {
  it("shows the draft and where to finish it when a later insert fails", () => {
    render(<CreatedCoursePanel course={{ id: "course-1", title: "Algebra" }} complete={false} />);

    expect(screen.getByRole("heading", { name: "Algebra" })).toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(
      screen.getByText(/Saving stopped before every lesson and assignment was added/),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Lessons" })).toHaveAttribute(
      "href",
      "/instructor/courses/course-1/lessons",
    );
    expect(screen.getByRole("link", { name: "Assignments" })).toHaveAttribute(
      "href",
      "/instructor/courses/course-1/assignments",
    );
  });
});

describe("CourseBuilderScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listCourseCategories.mockResolvedValue({ ok: true, categories: [] });
  });

  it("does not show a created course before a save", async () => {
    render(<CourseBuilderScreen instructorId="instructor-1" />);

    expect(await screen.findByRole("heading", { name: "AI Course Builder" })).toBeInTheDocument();
    expect(screen.queryByText(/This draft was created/)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Lessons" })).not.toBeInTheDocument();
  });
});
