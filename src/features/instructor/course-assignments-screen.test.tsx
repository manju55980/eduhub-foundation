import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CourseAssignmentsScreen } from "./course-assignments-screen";
import { createAssignment, listCourseAssignments, updateAssignment } from "./assignments-api";
import { getOwnedCourse } from "./lessons-api";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children?: ReactNode; to?: string }) => (
    <a href={to ?? "#"}>{children}</a>
  ),
}));

vi.mock("./lessons-api", () => ({
  getOwnedCourse: vi.fn(),
}));

vi.mock("./assignments-api", () => ({
  listCourseAssignments: vi.fn(),
  createAssignment: vi.fn(),
  updateAssignment: vi.fn(),
}));

const getCourse = vi.mocked(getOwnedCourse);
const listAssignments = vi.mocked(listCourseAssignments);
const create = vi.mocked(createAssignment);
const update = vi.mocked(updateAssignment);

const stored = {
  id: "assignment-1",
  title: "Essay",
  description: "Write two pages.",
  dueDate: null,
  createdAt: "2026-10-10T00:00:00.000Z",
};

describe("CourseAssignmentsScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not show a form when the course is not returned", async () => {
    getCourse.mockResolvedValue({ ok: true, course: null });
    listAssignments.mockResolvedValue({ ok: true, assignments: [] });

    render(<CourseAssignmentsScreen courseId="missing" />);

    expect(await screen.findByText("This course is not available.")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "My Courses (including lessons)" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save assignment" })).not.toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
  });

  it("shows an empty list and requires a title and description", async () => {
    getCourse.mockResolvedValue({ ok: true, course: { id: "course-1", title: "Intro to React" } });
    listAssignments.mockResolvedValue({ ok: true, assignments: [] });

    render(<CourseAssignmentsScreen courseId="course-1" />);

    expect(await screen.findByRole("heading", { name: "Intro to React" })).toBeInTheDocument();
    expect(screen.getByText("This course has no assignments yet.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /delete/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save lesson" })).not.toBeInTheDocument();

    const form = screen.getByRole("button", { name: "Save assignment" }).closest("form");
    fireEvent.submit(form!);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Enter an assignment title. Enter an assignment description.",
    );
    expect(create).not.toHaveBeenCalled();
  });

  it("creates an assignment for this course and stores a blank due date as null", async () => {
    getCourse.mockResolvedValue({ ok: true, course: { id: "course-1", title: null } });
    listAssignments.mockResolvedValue({ ok: true, assignments: [] });
    create.mockResolvedValue({
      ok: true,
      assignment: { ...stored, createdAt: "2026-10-11T00:00:00.000Z" },
    });

    render(<CourseAssignmentsScreen courseId="course-1" />);

    expect(await screen.findByRole("heading", { name: "Assignments" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Title/), { target: { value: "  Essay  " } });
    fireEvent.change(screen.getByLabelText(/Description/), {
      target: { value: "  Write two pages.  " },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Save assignment" }).closest("form")!);

    expect(await screen.findByRole("status")).toHaveTextContent("This assignment was saved.");
    expect(create).toHaveBeenCalledWith("course-1", {
      title: "Essay",
      description: "Write two pages.",
      dueDate: null,
    });
    expect(update).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Essay" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Assignments" })).toBeInTheDocument();
  });

  it("updates only the assignment text and due date", async () => {
    getCourse.mockResolvedValue({ ok: true, course: { id: "course-1", title: "Intro to React" } });
    listAssignments.mockResolvedValue({ ok: true, assignments: [stored] });
    update.mockResolvedValue({ ok: true });

    render(<CourseAssignmentsScreen courseId="course-1" />);

    expect(await screen.findByRole("heading", { name: "Essay" })).toBeInTheDocument();
    expect(screen.getByText("Write two pages.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getAllByLabelText(/Title/)[1]!, { target: { value: "Revised essay" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(update).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Essay" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getAllByLabelText(/Title/)[1]!, { target: { value: "Revised essay" } });
    const saveButtons = screen.getAllByRole("button", { name: "Save assignment" });
    fireEvent.submit(saveButtons[1]!.closest("form")!);

    expect(await screen.findByRole("status")).toHaveTextContent("This assignment was updated.");
    expect(update).toHaveBeenCalledWith("assignment-1", {
      title: "Revised essay",
      description: "Write two pages.",
      dueDate: null,
    });
    expect(create).not.toHaveBeenCalled();
  });

  it("does not offer save when assignments fail to load", async () => {
    getCourse.mockResolvedValue({ ok: true, course: { id: "course-1", title: "Intro to React" } });
    listAssignments.mockResolvedValue({ ok: false, message: "Could not load assignments." });

    render(<CourseAssignmentsScreen courseId="course-1" />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load assignments.");
    expect(screen.queryByRole("button", { name: "Save assignment" })).not.toBeInTheDocument();
    expect(screen.queryByText("This course has no assignments yet.")).not.toBeInTheDocument();
  });
});
