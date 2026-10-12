import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AssignmentsScreen } from "./assignments-screen";
import { listStudentAssignments, submitAssignment } from "./assignments-api";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children?: ReactNode; to?: string }) => (
    <a href={to ?? "#"}>{children}</a>
  ),
}));

vi.mock("./assignments-api", () => ({
  listStudentAssignments: vi.fn(),
  submitAssignment: vi.fn(),
}));

const listAssignments = vi.mocked(listStudentAssignments);
const submit = vi.mocked(submitAssignment);

const openAssignment = {
  id: "assignment-1",
  title: "Essay",
  description: "Write two pages.",
  dueDate: "2020-01-01T00:00:00.000Z",
  createdAt: "2026-10-10T00:00:00.000Z",
  courseTitle: "Archived course",
  submission: null,
};

describe("AssignmentsScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows an empty list without a submit control", async () => {
    listAssignments.mockResolvedValue({ ok: true, assignments: [] });

    render(<AssignmentsScreen studentId="student-1" />);

    expect(screen.getByText("Loading assignments…")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Submit" })).not.toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Assignments" })).toBeInTheDocument();
    expect(screen.getByText("You have no assignments.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse Courses" })).toHaveAttribute(
      "href",
      "/student/courses",
    );
    expect(screen.queryByRole("button", { name: "Submit" })).not.toBeInTheDocument();
  });

  it("shows instructions and still offers submit when the due date has passed", async () => {
    listAssignments.mockResolvedValue({ ok: true, assignments: [openAssignment] });

    render(<AssignmentsScreen studentId="student-1" />);

    expect(await screen.findByRole("heading", { name: "Essay" })).toBeInTheDocument();
    expect(screen.getByText("Write two pages.")).toBeInTheDocument();
    expect(screen.getByText("Archived course")).toBeInTheDocument();
    expect(screen.getByText(formatDueAt(openAssignment.dueDate))).toBeInTheDocument();
    expect(screen.getByText(formatCreatedAt(openAssignment.createdAt))).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit" })).toBeInTheDocument();
    expect(screen.queryByLabelText(/grade/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/feedback/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/instructor/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /resubmit|delete|upload/i }),
    ).not.toBeInTheDocument();
  });

  it("rejects a blank submission before inserting", async () => {
    listAssignments.mockResolvedValue({ ok: true, assignments: [openAssignment] });

    render(<AssignmentsScreen studentId="student-1" />);

    fireEvent.click(await screen.findByRole("button", { name: "Submit" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Enter your submission.");
    expect(submit).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Submit" })).toBeInTheDocument();
  });

  it("submits once and leaves the card without another submit control", async () => {
    listAssignments.mockResolvedValue({ ok: true, assignments: [openAssignment] });
    submit.mockResolvedValue({ ok: true });

    render(<AssignmentsScreen studentId="student-1" />);

    fireEvent.change(await screen.findByLabelText(/Submission/), {
      target: { value: "  My essay.  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByRole("status")).toHaveTextContent("This assignment was submitted.");
    expect(submit).toHaveBeenCalledWith("student-1", "assignment-1", "My essay.");
    expect(screen.getByText("My essay.")).toBeInTheDocument();
    expect(screen.getByText("Submitted")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Submit" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Assignments" })).toBeInTheDocument();
  });

  it("shows a graded submission without a submit control", async () => {
    listAssignments.mockResolvedValue({
      ok: true,
      assignments: [
        {
          ...openAssignment,
          submission: { contentUrl: "Done", status: "graded" },
        },
      ],
    });

    render(<AssignmentsScreen studentId="student-1" />);

    expect(await screen.findByText("Done")).toBeInTheDocument();
    expect(screen.getByText("Graded")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Submit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /edit|resubmit|delete/i })).not.toBeInTheDocument();
  });

  it("leaves the entered text when submit fails", async () => {
    listAssignments.mockResolvedValue({ ok: true, assignments: [openAssignment] });
    submit.mockResolvedValue({ ok: false, message: "duplicate key value" });

    render(<AssignmentsScreen studentId="student-1" />);

    fireEvent.change(await screen.findByLabelText(/Submission/), {
      target: { value: "My essay." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("duplicate key value");
    expect(screen.getByLabelText(/Submission/)).toHaveValue("My essay.");
    expect(screen.getByRole("button", { name: "Submit" })).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("does not offer submit when the list fails to load", async () => {
    listAssignments.mockResolvedValue({ ok: false, message: "Could not load assignments." });

    render(<AssignmentsScreen studentId="student-1" />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load assignments.");
    expect(screen.queryByRole("button", { name: "Submit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Browse Courses" })).not.toBeInTheDocument();
  });
});

function formatCreatedAt(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function formatDueAt(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
