import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SubmissionsScreen } from "./submissions-screen";
import { listInstructorSubmissions, saveGrade } from "./submissions-api";

vi.mock("./submissions-api", () => ({
  listInstructorSubmissions: vi.fn(),
  saveGrade: vi.fn(),
}));

const listSubmissions = vi.mocked(listInstructorSubmissions);
const save = vi.mocked(saveGrade);

const submitted = {
  id: "submission-1",
  contentUrl: "My essay.",
  grade: null,
  feedback: null,
  status: "submitted",
  createdAt: "2026-10-10T00:00:00.000Z",
  assignmentTitle: "Essay",
  courseTitle: "Archived course",
  studentName: "Ada Lovelace",
};

describe("SubmissionsScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows an empty list without a save control", async () => {
    listSubmissions.mockResolvedValue({ ok: true, submissions: [] });

    render(<SubmissionsScreen />);

    expect(screen.getByText("Loading submissions…")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save grade" })).not.toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { name: "Submissions (grading)" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "To Grade" })).toHaveAttribute("data-state", "active");
    expect(screen.getByText("No submissions to grade.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save grade" })).not.toBeInTheDocument();
  });

  it("keeps submitted work in To Grade and graded work in Graded", async () => {
    listSubmissions.mockResolvedValue({
      ok: true,
      submissions: [
        submitted,
        {
          ...submitted,
          id: "submission-2",
          assignmentTitle: "Quiz",
          grade: "8",
          feedback: "Clear.",
          status: "graded",
        },
      ],
    });

    render(<SubmissionsScreen />);

    expect(await screen.findByRole("heading", { name: "Essay" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Quiz" })).not.toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole("tab", { name: "Graded" }));

    const gradedCard = (await screen.findByRole("heading", { name: "Quiz" })).closest("article");
    expect(gradedCard).not.toBeNull();
    expect(within(gradedCard as HTMLElement).getByRole("spinbutton", { name: /^Grade / })).toHaveValue(
      8,
    );
    expect(
      within(gradedCard as HTMLElement).getByRole("textbox", { name: "Feedback" }),
    ).toHaveValue("Clear.");
    expect(screen.queryByRole("heading", { name: "Essay" })).not.toBeInTheDocument();
  });

  it("shows the submission and rejects a blank grade", async () => {
    listSubmissions.mockResolvedValue({ ok: true, submissions: [submitted] });

    render(<SubmissionsScreen />);

    expect(await screen.findByRole("heading", { name: "Essay" })).toBeInTheDocument();
    expect(screen.getByText("Archived course")).toBeInTheDocument();
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("My essay.")).toBeInTheDocument();
    expect(screen.getByText("Submitted")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /delete/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/file|upload/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Save grade" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Enter a grade.");
    expect(save).not.toHaveBeenCalled();
    expect(screen.getByText("My essay.")).toBeInTheDocument();
  });

  it("saves a trimmed grade and marks the submission graded", async () => {
    listSubmissions.mockResolvedValue({ ok: true, submissions: [submitted] });
    save.mockResolvedValue({ ok: true });

    render(<SubmissionsScreen />);

    fireEvent.change(await screen.findByRole("spinbutton", { name: /^Grade / }), {
      target: { value: "8" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save grade" }));

    expect(await screen.findByRole("status")).toHaveTextContent("This submission was graded.");
    expect(save).toHaveBeenCalledWith("submission-1", { grade: "8", feedback: null });
    expect(screen.getByRole("tab", { name: "To Grade" })).toHaveAttribute("data-state", "active");
    expect(screen.getByText("No submissions to grade.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Essay" })).not.toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole("tab", { name: "Graded" }));

    const gradedCard = (await screen.findByRole("heading", { name: "Essay" })).closest("article");
    expect(gradedCard).not.toBeNull();
    expect(within(gradedCard as HTMLElement).getByText("Graded")).toBeInTheDocument();
    expect(within(gradedCard as HTMLElement).getByRole("spinbutton", { name: /^Grade / })).toHaveValue(
      8,
    );
    expect(within(gradedCard as HTMLElement).getByText("My essay.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Submissions (grading)" })).toBeInTheDocument();
  });

  it("saves a graded submission again without changing the submitted text", async () => {
    listSubmissions.mockResolvedValue({
      ok: true,
      submissions: [{ ...submitted, grade: "7", feedback: "Clear.", status: "graded" }],
    });
    save.mockResolvedValue({ ok: true });

    render(<SubmissionsScreen />);

    fireEvent.mouseDown(await screen.findByRole("tab", { name: "Graded" }));

    expect(await screen.findByRole("spinbutton", { name: /^Grade / })).toHaveValue(7);
    expect(screen.getByRole("textbox", { name: "Feedback" })).toHaveValue("Clear.");
    fireEvent.change(screen.getByRole("spinbutton", { name: /^Grade / }), {
      target: { value: "11" },
    });
    expect(screen.getByRole("spinbutton", { name: /^Grade / })).toHaveValue(7);
    fireEvent.change(screen.getByRole("spinbutton", { name: /^Grade / }), {
      target: { value: "10" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save grade" }));

    expect(await screen.findByRole("status")).toHaveTextContent("This submission was graded.");
    expect(save).toHaveBeenCalledWith("submission-1", {
      grade: "10",
      feedback: "Clear.",
    });
    expect(screen.getByText("My essay.")).toBeInTheDocument();
  });

  it("leaves the entered grade when save fails", async () => {
    listSubmissions.mockResolvedValue({ ok: true, submissions: [submitted] });
    save.mockResolvedValue({ ok: false, message: "course update is not allowed" });

    render(<SubmissionsScreen />);

    fireEvent.change(await screen.findByRole("spinbutton", { name: /^Grade / }), {
      target: { value: "6" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Feedback" }), {
      target: { value: "Clear." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save grade" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("course update is not allowed");
    expect(screen.getByRole("spinbutton", { name: /^Grade / })).toHaveValue(6);
    expect(screen.getByRole("textbox", { name: "Feedback" })).toHaveValue("Clear.");
    expect(screen.getByText("Submitted")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("does not offer save when submissions fail to load", async () => {
    listSubmissions.mockResolvedValue({ ok: false, message: "Could not load submissions." });

    render(<SubmissionsScreen />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load submissions.");
    expect(screen.queryByRole("tab", { name: "To Grade" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save grade" })).not.toBeInTheDocument();
    expect(screen.queryByText("Essay")).not.toBeInTheDocument();
  });
});
