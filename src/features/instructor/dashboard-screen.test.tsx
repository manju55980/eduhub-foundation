import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { InstructorDashboardScreen } from "./dashboard-screen";
import { listInstructorCourses } from "./my-courses-api";
import { listInstructorSubmissions } from "./submissions-api";

vi.mock("./my-courses-api", () => ({
  listInstructorCourses: vi.fn(),
}));

vi.mock("./submissions-api", () => ({
  listInstructorSubmissions: vi.fn(),
}));

const listCourses = vi.mocked(listInstructorCourses);
const listSubmissions = vi.mocked(listInstructorSubmissions);

function course(id: string, title: string, createdAt: string) {
  return {
    id,
    title,
    description: "Core skills.",
    level: "beginner",
    status: "draft",
    categoryId: null,
    createdAt,
    lessonCount: 1,
  };
}

function submission(id: string, title: string, status: string) {
  return {
    id,
    contentUrl: "https://notes.example/1",
    grade: status === "graded" ? "Pass" : null,
    feedback: null,
    status,
    createdAt: "2026-10-10T00:00:00.000Z",
    assignmentTitle: title,
    courseTitle: "Algebra",
    studentName: "Ada Lovelace",
  };
}

describe("InstructorDashboardScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listCourses.mockResolvedValue({ ok: true, courses: [] });
    listSubmissions.mockResolvedValue({ ok: true, submissions: [] });
  });

  it("greets the signed-in instructor and shows empty overview sections", async () => {
    render(<InstructorDashboardScreen fullName="  Grace Hopper  " />);

    expect(screen.getByText("Loading dashboard…")).toBeInTheDocument();
    expect(await screen.findByText("No submissions to grade.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Welcome back, Grace Hopper" })).toBeInTheDocument();
    expect(screen.getByText("You have no courses yet.")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("uses Instructor when the signed-in name is blank", async () => {
    render(<InstructorDashboardScreen fullName="   " />);

    expect(
      await screen.findByRole("heading", { name: "Welcome back, Instructor" }),
    ).toBeInTheDocument();
  });

  it("shows submissions to grade and only the four newest courses", async () => {
    listSubmissions.mockResolvedValue({
      ok: true,
      submissions: [
        submission("submission-1", "Essay", "submitted"),
        submission("submission-2", "Quiz", "graded"),
      ],
    });
    listCourses.mockResolvedValue({
      ok: true,
      courses: [
        course("course-1", "Newest", "2026-10-10T00:00:00.000Z"),
        course("course-2", "Second", "2026-10-09T00:00:00.000Z"),
        course("course-3", "Third", "2026-10-08T00:00:00.000Z"),
        course("course-4", "Fourth", "2026-10-07T00:00:00.000Z"),
        course("course-5", "Older", "2026-10-06T00:00:00.000Z"),
      ],
    });

    render(<InstructorDashboardScreen fullName="Grace" />);

    const card = (await screen.findByRole("heading", { name: "Essay" })).closest("article");
    expect(card).not.toBeNull();
    const view = within(card as HTMLElement);
    expect(view.getByText("Submitted")).toBeInTheDocument();
    expect(view.getByText("Algebra")).toBeInTheDocument();
    expect(view.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Quiz" })).not.toBeInTheDocument();
    expect(screen.queryByText("Pass")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Newest" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Fourth" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Older" })).not.toBeInTheDocument();
    expect(screen.getAllByText("Beginner")).toHaveLength(4);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /save grade|submit|create/i }),
    ).not.toBeInTheDocument();
  });

  it("hides a section when its query fails and keeps the other", async () => {
    listSubmissions.mockResolvedValue({ ok: false, message: "submissions unavailable" });
    listCourses.mockResolvedValue({
      ok: true,
      courses: [course("course-1", "Newest", "2026-10-10T00:00:00.000Z")],
    });

    render(<InstructorDashboardScreen fullName="Grace" />);

    expect(await screen.findByText("submissions unavailable")).toBeInTheDocument();
    expect(screen.queryByText("No submissions to grade.")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Newest" })).toBeInTheDocument();
  });
});
