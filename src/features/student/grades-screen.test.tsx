import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GradesScreen } from "./grades-screen";
import { listStudentGrades } from "./grades-api";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children?: ReactNode; to?: string }) => (
    <a href={to ?? "#"}>{children}</a>
  ),
}));

vi.mock("./grades-api", () => ({
  listStudentGrades: vi.fn(),
}));

const listGrades = vi.mocked(listStudentGrades);

const graded = {
  id: "submission-1",
  contentUrl: "My essay.",
  grade: "Pass",
  feedback: "Clear.",
  status: "graded",
  createdAt: "2026-10-10T00:00:00.000Z",
  assignmentTitle: "Essay",
  description: "Write one page.",
  dueDate: "2020-01-01T00:00:00.000Z",
  courseTitle: "Archived course",
};

describe("GradesScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows an empty list that links to Assignments", async () => {
    listGrades.mockResolvedValue({ ok: true, grades: [] });

    render(<GradesScreen studentId="student-1" />);

    expect(screen.getByText("Loading grades…")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Assignments" })).not.toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "My Grades" })).toBeInTheDocument();
    expect(screen.getByText("You have no grades yet.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Assignments" })).toHaveAttribute(
      "href",
      "/student/assignments",
    );
    expect(
      screen.queryByRole("button", { name: /save|submit|delete|edit/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows a graded submission without an edit control", async () => {
    listGrades.mockResolvedValue({ ok: true, grades: [graded] });

    render(<GradesScreen studentId="student-1" />);

    const card = (await screen.findByRole("heading", { name: "Essay" })).closest("article");
    expect(card).not.toBeNull();
    const view = within(card as HTMLElement);
    expect(view.getByText("Write one page.")).toBeInTheDocument();
    expect(view.getByText("Archived course")).toBeInTheDocument();
    expect(view.getByText("My essay.")).toBeInTheDocument();
    expect(view.getByText("Pass")).toBeInTheDocument();
    expect(view.getByText("Clear.")).toBeInTheDocument();
    expect(view.getByText("Graded")).toBeInTheDocument();
    expect(view.getByText("Due date").parentElement).toHaveTextContent("2020");
    expect(screen.queryByText(/instructor/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/lesson/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/progress/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /save|submit|delete|edit|resubmit/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/file|upload/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("keeps a grade when the assignment title is missing", async () => {
    listGrades.mockResolvedValue({
      ok: true,
      grades: [
        {
          ...graded,
          assignmentTitle: null,
          description: null,
          dueDate: null,
          courseTitle: null,
          feedback: null,
          grade: "18/20",
        },
      ],
    });

    render(<GradesScreen studentId="student-1" />);

    expect(await screen.findByText("18/20")).toBeInTheDocument();
    expect(screen.getByText("My essay.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Essay" })).not.toBeInTheDocument();
    expect(screen.queryByText("Clear.")).not.toBeInTheDocument();
  });

  it("does not show cards when grades fail to load", async () => {
    listGrades.mockResolvedValue({ ok: false, message: "Could not load grades." });

    render(<GradesScreen studentId="student-1" />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load grades.");
    expect(screen.queryByText("Essay")).not.toBeInTheDocument();
    expect(screen.queryByText("Pass")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Assignments" })).not.toBeInTheDocument();
  });
});
