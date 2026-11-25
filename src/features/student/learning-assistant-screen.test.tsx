import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LearningAssistantScreen } from "./learning-assistant-screen";
import { askLearningAssistant } from "./learning-assistant-api";
import {
  clearAiMessages,
  createAiThread,
  listAiThreads,
  loadAiMessages,
} from "@/features/ai/ai-thread-api";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    search,
    className,
  }: {
    children?: ReactNode;
    search?: { from?: string };
    className?: string;
  }) => (
    <a href={search?.from ? `?from=${search.from}` : "#"} className={className}>
      {children}
    </a>
  ),
}));

vi.mock("./learning-assistant-api", () => ({
  askLearningAssistant: vi.fn(),
}));

vi.mock("@/features/ai/ai-thread-api", () => ({
  listAiThreads: vi.fn(),
  createAiThread: vi.fn(),
  loadAiMessages: vi.fn(),
  clearAiMessages: vi.fn(),
}));

const ask = vi.mocked(askLearningAssistant);
const listThreads = vi.mocked(listAiThreads);
const loadMessages = vi.mocked(loadAiMessages);
const clearMessages = vi.mocked(clearAiMessages);
const createThread = vi.mocked(createAiThread);

const thread = { id: "thread-1", title: "New chat", updatedAt: "2026-11-24T00:00:00.000Z" };

describe("LearningAssistantScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listThreads.mockResolvedValue({ ok: true, threads: [thread] });
    loadMessages.mockResolvedValue({ ok: true, messages: [] });
    clearMessages.mockResolvedValue({ ok: true });
    createThread.mockResolvedValue({
      ok: true,
      thread: { id: "thread-2", title: "New chat", updatedAt: "2026-11-24T00:00:00.000Z" },
    });
  });

  async function typeAndSend(value: string) {
    await screen.findByRole("meter", { name: "Context window 0 of 8 messages" });
    fireEvent.change(screen.getByLabelText(/Question/), { target: { value } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
  }

  it("shows the empty prompt and does not send a blank question", () => {
    render(<LearningAssistantScreen />);

    expect(
      screen.getByText(
        "Ask about a course, a recommendation, your grades, or the next course to take.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
    expect(ask).not.toHaveBeenCalled();
  });

  it("shows the answer and the enrolment sentence", async () => {
    ask.mockResolvedValue({
      ok: true,
      text: "Algebra is a fit.",
      courses: [{ id: "course-1", title: "Algebra" }],
      enrolled: { id: "course-1", title: "Algebra" },
    });

    render(<LearningAssistantScreen />);
    await typeAndSend("Enrol me");

    expect(await screen.findByText(/Algebra is a fit./)).toBeInTheDocument();
    expect(screen.getByText(/You are enrolled in this course\./)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Algebra" })).toHaveAttribute(
      "href",
      "?from=assistant",
    );
    expect(screen.getByRole("link", { name: "Algebra" }).className).toContain("hover:underline");
    expect(
      screen.queryByText(
        "Ask about a course, a recommendation, your grades, or the next course to take.",
      ),
    ).not.toBeInTheDocument();
  });

  it("sends an earlier course id with the next question", async () => {
    const courseId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    ask.mockResolvedValue({
      ok: true,
      text: "Algebra is a fit.",
      courses: [{ id: courseId, title: "Algebra" }],
      enrolled: null,
    });

    render(<LearningAssistantScreen />);
    await typeAndSend("Suggest a course");
    expect(await screen.findByText("Algebra is a fit.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Question/), {
      target: { value: "Enrol me in Algebra" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(ask).toHaveBeenCalledTimes(2));
    expect(ask).toHaveBeenNthCalledWith(2, "thread-1", "Enrol me in Algebra");
    expect(screen.getAllByText("Algebra is a fit.")).toHaveLength(2);
    expect(screen.queryByText(courseId)).not.toBeInTheDocument();
  });

  it("keeps an error inline and disables sending while a request is open", async () => {
    let finish: (value: { ok: false; message: string }) => void = () => undefined;
    ask.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );

    render(<LearningAssistantScreen />);
    await typeAndSend("My grades");

    expect(await screen.findByText("Sending…")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send" })).not.toBeInTheDocument();

    finish({ ok: false, message: "The AI request failed." });

    expect(await screen.findByRole("alert")).toHaveTextContent("The AI request failed.");
    expect(screen.queryByText("Learning Assistant", { selector: "p" })).not.toBeInTheDocument();
  });

  it("blocks a full chat until it is cleared", async () => {
    loadMessages.mockResolvedValue({
      ok: true,
      messages: Array.from({ length: 8 }, (_, index) => ({
        id: `message-${index}`,
        role: index % 2 === 0 ? "user" : "assistant",
        content: `Message ${index}`,
        payload: {},
      })),
    });
    ask.mockResolvedValue({ ok: true, text: "Next", courses: [], enrolled: null });

    render(<LearningAssistantScreen />);
    expect(
      await screen.findByRole("meter", { name: "Context window 8 of 8 messages" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("This chat is full. Clear it or start a new chat."),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Question/), { target: { value: "Another" } });
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Clear chat" }));
    expect(
      await screen.findByRole("meter", { name: "Context window 0 of 8 messages" }),
    ).toBeInTheDocument();
    expect(clearMessages).toHaveBeenCalledWith("thread-1");
    fireEvent.change(screen.getByLabelText(/Question/), { target: { value: "Another" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(ask).toHaveBeenCalledWith("thread-1", "Another"));
  });

  it("opens a new chat and can reopen the previous one", async () => {
    listThreads.mockResolvedValue({
      ok: true,
      threads: [
        { id: "thread-1", title: "Earlier question", updatedAt: "2026-11-24T00:00:00.000Z" },
      ],
    });
    loadMessages.mockResolvedValue({
      ok: true,
      messages: [{ id: "message-1", role: "user", content: "Earlier question", payload: {} }],
    });

    render(<LearningAssistantScreen />);
    expect(await screen.findByRole("button", { name: "Earlier question" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "New chat" }));
    await waitFor(() => expect(createThread).toHaveBeenCalledWith("assistant", null));
    expect(screen.queryByText("Earlier question", { selector: "p" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Earlier question" }));
    expect(await screen.findByText("Earlier question")).toBeInTheDocument();
  });
});
