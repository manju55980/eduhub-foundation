import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LearningAssistantScreen } from "./learning-assistant-screen";
import { askLearningAssistant } from "./learning-assistant-api";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children?: ReactNode }) => <a href="#">{children}</a>,
}));

vi.mock("./learning-assistant-api", () => ({
  askLearningAssistant: vi.fn(),
}));

const ask = vi.mocked(askLearningAssistant);

describe("LearningAssistantScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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
    fireEvent.change(screen.getByLabelText(/Question/), { target: { value: "Enrol me" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByText(/Algebra is a fit./)).toBeInTheDocument();
    expect(screen.getByText(/You are enrolled in this course\./)).toBeInTheDocument();
    expect(screen.getByText("Algebra")).toBeInTheDocument();
    expect(
      screen.queryByText(
        "Ask about a course, a recommendation, your grades, or the next course to take.",
      ),
    ).not.toBeInTheDocument();
  });

  it("keeps an error inline and disables sending while a request is open", async () => {
    let finish: (value: { ok: false; message: string }) => void = () => undefined;
    ask.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );

    render(<LearningAssistantScreen />);
    fireEvent.change(screen.getByLabelText(/Question/), { target: { value: "My grades" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByRole("button", { name: "Sending…" })).toBeDisabled();

    finish({ ok: false, message: "The AI request failed." });

    expect(await screen.findByRole("alert")).toHaveTextContent("The AI request failed.");
    expect(screen.queryByText("Learning Assistant", { selector: "p" })).not.toBeInTheDocument();
  });
});
