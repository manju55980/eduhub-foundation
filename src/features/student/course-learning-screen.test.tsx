import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CourseLearningScreen } from "./course-learning-screen";
import { loadCourseLearning } from "./course-learning-api";
import { loadLessonProgress, markLessonComplete } from "@/features/notifications/notifications-api";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children?: ReactNode }) => <a>{children}</a>,
}));

vi.mock("./course-learning-api", () => ({
  loadCourseLearning: vi.fn(),
}));

vi.mock("@/features/notifications/notifications-api", async () => {
  const actual = await vi.importActual<typeof import("@/features/notifications/notifications-api")>(
    "@/features/notifications/notifications-api",
  );
  return {
    ...actual,
    loadLessonProgress: vi.fn(),
    markLessonComplete: vi.fn(),
  };
});

const loadLearning = vi.mocked(loadCourseLearning);
const loadProgress = vi.mocked(loadLessonProgress);
const markComplete = vi.mocked(markLessonComplete);

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
    loadProgress.mockResolvedValue({
      ok: true,
      enrolled: true,
      enrollmentStatus: "active",
      completedLessonIds: [],
      certificateIssuedAt: null,
    });
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

  it("marks one lesson complete and shows the certificate only after completion", async () => {
    let resolveSave: (value: { ok: true }) => void = () => {};
    markComplete.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSave = resolve;
        }),
    );
    loadProgress
      .mockResolvedValueOnce({
        ok: true,
        enrolled: true,
        enrollmentStatus: "active",
        completedLessonIds: [],
        certificateIssuedAt: "2026-10-01T00:00:00.000Z",
      })
      .mockResolvedValueOnce({
        ok: true,
        enrolled: true,
        enrollmentStatus: "completed",
        completedLessonIds: ["lesson-1"],
        certificateIssuedAt: "2026-10-18T15:00:00.000Z",
      });
    loadLearning.mockResolvedValue({
      ok: true,
      course: { id: "course-1", title: "Algebra" },
      enrolled: true,
      lessons: [lesson],
    });

    render(<CourseLearningScreen courseId="course-1" studentId="student-1" />);

    const button = await screen.findByRole("button", { name: "Mark complete" });
    expect(screen.queryByText(/Certificate issued/)).not.toBeInTheDocument();
    fireEvent.click(button);
    fireEvent.click(button);
    expect(markComplete).toHaveBeenCalledTimes(1);
    resolveSave({ ok: true });

    expect(await screen.findByText("This lesson is complete.")).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.getByText(/Certificate issued/)).toHaveTextContent("Algebra");
    expect(screen.queryByRole("button", { name: "Mark complete" })).not.toBeInTheDocument();
    expect(markComplete).toHaveBeenCalledWith("student-1", "lesson-1");
  });
});
