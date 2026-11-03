import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { notifyCourseCompletion } from "@/features/integrations/student-email-api";

import { CourseLearningScreen } from "./course-learning-screen";
import { loadCourseLearning } from "./course-learning-api";
import { loadLessonProgress, markLessonComplete } from "@/features/notifications/notifications-api";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children?: ReactNode; to?: string }) => (
    <a href={to ?? "#"}>{children}</a>
  ),
}));

vi.mock("./course-learning-api", () => ({
  loadCourseLearning: vi.fn(),
}));

vi.mock("@/features/integrations/student-email-api", () => ({
  notifyCourseCompletion: vi.fn(async () => undefined),
}));

vi.mock("@/features/instructor/course-materials-api", () => ({
  listCourseMaterials: vi.fn(async () => ({ ok: true, materials: [] })),
  createMaterialDownloadUrl: vi.fn(),
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
const notifyCompletion = vi.mocked(notifyCourseCompletion);

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
      progress: 0,
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
    expect(screen.queryByText("This course has no files yet.")).not.toBeInTheDocument();
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
    expect(screen.getByText("This course has no lessons yet.")).toBeInTheDocument();
    expect(await screen.findByText("This course has no files yet.")).toBeInTheDocument();
    expect(screen.queryByLabelText("File")).not.toBeInTheDocument();
    expect(screen.queryByText(/lessons complete/)).not.toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
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
        progress: 0,
        completedLessonIds: [],
        certificateIssuedAt: "2026-10-01T00:00:00.000Z",
      })
      .mockResolvedValueOnce({
        ok: true,
        enrolled: true,
        enrollmentStatus: "completed",
        progress: 100,
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
    expect(notifyCompletion).toHaveBeenCalledWith("course-1");
    expect(screen.getByText("1 of 1 lessons complete")).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "1 of 1 lessons complete" })).toHaveAttribute(
      "aria-valuenow",
      "100",
    );
  });

  it("shows stored progress without a width transition and follows from", async () => {
    loadProgress.mockResolvedValue({
      ok: true,
      enrolled: true,
      enrollmentStatus: "active",
      progress: 40,
      completedLessonIds: [],
      certificateIssuedAt: null,
    });
    loadLearning.mockResolvedValue({
      ok: true,
      course: { id: "course-1", title: "Algebra" },
      enrolled: true,
      lessons: [lesson, { ...lesson, id: "lesson-2", title: "Products" }],
    });

    render(<CourseLearningScreen courseId="course-1" studentId="student-1" from="assistant" />);

    expect(await screen.findByText("0 of 2 lessons complete")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Learning Assistant" })).toHaveAttribute(
      "href",
      "/student/assistant",
    );
    const meter = screen.getByRole("progressbar", { name: "0 of 2 lessons complete" });
    expect(meter).toHaveAttribute("aria-valuenow", "40");
    expect(meter).toHaveAttribute("aria-valuetext", "0 of 2 lessons complete, 40%");
    const fill = meter.firstElementChild;
    expect(fill).toHaveStyle({ width: "40%" });
    expect(fill?.className).not.toContain("transition");
    expect(fill?.className).toContain("bg-positive");
    expect(meter.className).toContain("bg-muted");
  });

  it("keeps the previous percentage when progress cannot be re-read", async () => {
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
        progress: 40,
        completedLessonIds: [],
        certificateIssuedAt: null,
      })
      .mockResolvedValueOnce({ ok: false, message: "Could not read progress." });
    loadLearning.mockResolvedValue({
      ok: true,
      course: { id: "course-1", title: "Algebra" },
      enrolled: true,
      lessons: [lesson],
    });

    render(<CourseLearningScreen courseId="course-1" studentId="student-1" from="my-courses" />);

    expect(await screen.findByRole("link", { name: "My Courses" })).toHaveAttribute(
      "href",
      "/student/my-courses",
    );
    fireEvent.click(await screen.findByRole("button", { name: "Mark complete" }));
    resolveSave({ ok: true });

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not read progress.");
    expect(screen.getByText("1 of 1 lessons complete")).toBeInTheDocument();
    expect(screen.getByText("40%")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "1 of 1 lessons complete" })).toHaveAttribute(
      "aria-valuenow",
      "40",
    );
    expect(screen.getByText("Completed")).toHaveClass("text-sm");
  });
});
