import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CourseLearningScreen } from "./course-learning-screen";
import { loadCourseLearning } from "./course-learning-api";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children?: ReactNode }) => <a>{children}</a>,
}));

vi.mock("./course-learning-api", () => ({
  loadCourseLearning: vi.fn(),
}));

const loadLearning = vi.mocked(loadCourseLearning);

const lesson = {
  id: "lesson-1",
  title: "Sums",
  content: "Add numbers",
  videoUrl: null,
  orderIndex: 1,
  createdAt: "2020-01-01T00:00:00.000Z",
};

describe("CourseLearningScreen study companion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("hides the companion when the student is not enrolled", async () => {
    loadLearning.mockResolvedValue({
      ok: true,
      course: { id: "course-1", title: "Algebra" },
      enrolled: false,
    });

    render(<CourseLearningScreen courseId="course-1" studentId="student-1" />);

    expect(await screen.findByText("Lessons are hidden until you enroll.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Study Companion" })).not.toBeInTheDocument();
  });

  it("shows the companion for an enrolled course and explains when there is no lesson content", async () => {
    loadLearning.mockResolvedValue({
      ok: true,
      course: { id: "course-1", title: "Algebra" },
      enrolled: true,
      lessons: [],
    });

    render(<CourseLearningScreen courseId="course-1" studentId="student-1" />);

    expect(await screen.findByRole("heading", { name: "Study Companion" })).toBeInTheDocument();
    expect(screen.getByText("This course has no lesson content yet.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ask" })).not.toBeInTheDocument();
  });

  it("asks a question only when the enrolled course has lesson content", async () => {
    loadLearning.mockResolvedValue({
      ok: true,
      course: { id: "course-1", title: "Algebra" },
      enrolled: true,
      lessons: [lesson],
    });

    render(<CourseLearningScreen courseId="course-1" studentId="student-1" />);

    expect(await screen.findByRole("heading", { name: "Study Companion" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Question *" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ask" })).toBeInTheDocument();
  });
});
