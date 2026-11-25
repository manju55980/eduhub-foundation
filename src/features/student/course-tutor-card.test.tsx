import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CourseTutorCard } from "./course-tutor-card";
import { askCourseTutor, checkCourseTutorAnswer } from "./course-tutor-api";

vi.mock("./course-tutor-api", () => ({
  askCourseTutor: vi.fn(),
  checkCourseTutorAnswer: vi.fn(),
}));

vi.mock("@/features/ai/ai-thread-api", () => ({
  listAiThreads: vi.fn(async () => ({
    ok: true,
    threads: [{ id: "thread-1", title: "New chat", updatedAt: "2026-11-24T00:00:00.000Z" }],
  })),
  createAiThread: vi.fn(),
  loadAiMessages: vi.fn(async () => ({ ok: true, messages: [] })),
  clearAiMessages: vi.fn(async () => ({ ok: true })),
}));

const ask = vi.mocked(askCourseTutor);
const check = vi.mocked(checkCourseTutorAnswer);
const courseId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("CourseTutorCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("asks for a question and checks only the student's answer", async () => {
    ask.mockResolvedValue({
      ok: true,
      result: {
        mode: "question",
        refused: false,
        question: "What does addition do?",
        difficulty: "starting",
        plan: [{ id: "lesson-1", title: "Sums", orderIndex: 1 }],
      },
    });
    check.mockResolvedValue({
      ok: true,
      result: {
        mode: "grade",
        refused: false,
        question: "What does addition do?",
        plan: [{ id: "lesson-1", title: "Sums", orderIndex: 1 }],
        context: [
          {
            id: "chunk-1",
            sourceType: "lesson",
            title: "Sums",
            body: "Add numbers",
            similarity: 0.8,
          },
        ],
        feedback: {
          verdict: "supported",
          feedback: "The cited lesson supports the answer.",
          citations: [{ id: "chunk-1", title: "Sums" }],
        },
      },
    });

    render(<CourseTutorCard courseId={courseId} lessonCount={2} />);
    const askButton = await screen.findByRole("button", { name: "Give me a question" });
    await waitFor(() => expect(askButton).toBeEnabled());
    fireEvent.click(askButton);
    await waitFor(() => expect(ask).toHaveBeenCalledTimes(1));

    expect(await screen.findByText("What does addition do?")).toBeInTheDocument();
    expect(screen.getByText("Starting question")).toBeInTheDocument();
    expect(screen.queryByText("Add numbers")).not.toBeInTheDocument();
    expect(ask).toHaveBeenCalledWith(courseId, "thread-1");

    fireEvent.change(screen.getByLabelText(/Your answer/), {
      target: { value: "It combines numbers" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Check my answer" }));

    expect(await screen.findByRole("heading", { name: "Feedback" })).toBeInTheDocument();
    expect(screen.getByText("Add numbers")).toBeInTheDocument();
    expect(screen.getByText("supported")).toBeInTheDocument();
    expect(check).toHaveBeenCalledWith({
      courseId,
      question: "What does addition do?",
      answer: "It combines numbers",
      threadId: "thread-1",
    });

    ask.mockResolvedValue({
      ok: true,
      result: {
        mode: "question",
        refused: false,
        question: "How do the two facts about addition fit together?",
        difficulty: "harder",
        plan: [{ id: "lesson-1", title: "Sums", orderIndex: 1 }],
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Give me another question" }));
    expect(await screen.findByText("Harder than the last question")).toBeInTheDocument();
    expect(
      screen.getByText("How do the two facts about addition fit together?"),
    ).toBeInTheDocument();
  });

  it("shows a refusal without the lesson text", async () => {
    ask.mockResolvedValue({
      ok: true,
      result: {
        refused: true,
        message: "A question could not be asked because confidence was too low.",
      },
    });

    render(<CourseTutorCard courseId={courseId} lessonCount={1} />);
    const askButton = await screen.findByRole("button", { name: "Give me a question" });
    await waitFor(() => expect(askButton).toBeEnabled());
    fireEvent.click(askButton);

    expect(
      await screen.findByText("A question could not be asked because confidence was too low."),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/Your answer/)).not.toBeInTheDocument();
    expect(check).not.toHaveBeenCalled();
  });
});
