import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ArchiveCoursesScreen } from "./archive-courses-screen";
import { archiveCourse, listPublishedCourses } from "./archive-courses-api";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children?: ReactNode; to?: string }) => (
    <a href={to ?? "#"}>{children}</a>
  ),
}));

vi.mock("./archive-courses-api", () => ({
  listPublishedCourses: vi.fn(),
  archiveCourse: vi.fn(),
}));

const listCourses = vi.mocked(listPublishedCourses);
const archive = vi.mocked(archiveCourse);

const course = {
  id: "course-1",
  title: "Intro to React",
  description: "Basics",
  level: "beginner",
  instructorName: "Ada Lovelace",
  createdAt: "2026-10-10T00:00:00.000Z",
};

describe("ArchiveCoursesScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows an empty list without an archive control", async () => {
    listCourses.mockResolvedValue({ ok: true, courses: [] });

    render(<ArchiveCoursesScreen />);

    expect(await screen.findByRole("heading", { name: "Archive Courses" })).toBeInTheDocument();
    expect(
      await screen.findByText("No published courses are available to archive."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Approve Courses" })).toHaveAttribute(
      "href",
      "/admin/courses/approvals",
    );
    expect(screen.queryByRole("button", { name: "Archive" })).not.toBeInTheDocument();
  });

  it("shows a published course without other status controls", async () => {
    listCourses.mockResolvedValue({
      ok: true,
      courses: [{ ...course, title: null, instructorName: null, description: null }],
    });

    render(<ArchiveCoursesScreen />);

    expect(await screen.findByRole("button", { name: "Archive" })).toBeInTheDocument();
    expect(screen.getByText("Beginner")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("");
    expect(screen.getByText("Instructor").parentElement?.querySelector("dd")?.textContent).toBe("");
    expect(
      screen.queryByRole("button", { name: /approve|reject|unarchive|delete|edit/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/lesson|grade|feedback|enrollment/i)).not.toBeInTheDocument();
  });

  it("archives the course and removes it from the published list", async () => {
    listCourses.mockResolvedValue({ ok: true, courses: [course] });
    archive.mockResolvedValue({ ok: true });

    render(<ArchiveCoursesScreen />);

    fireEvent.click(await screen.findByRole("button", { name: "Archive" }));

    await waitFor(() => expect(archive).toHaveBeenCalledWith("course-1"));
    expect(await screen.findByRole("status")).toHaveTextContent("This course was archived.");
    expect(screen.queryByRole("heading", { name: "Intro to React" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Archive Courses" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Archive" })).not.toBeInTheDocument();
  });

  it("leaves the course published when archive fails", async () => {
    listCourses.mockResolvedValue({ ok: true, courses: [course] });
    archive.mockResolvedValue({
      ok: false,
      message: "admins can publish a pending course or archive a published course",
    });

    render(<ArchiveCoursesScreen />);

    fireEvent.click(await screen.findByRole("button", { name: "Archive" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "admins can publish a pending course or archive a published course",
    );
    expect(screen.getByRole("heading", { name: "Intro to React" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Archive" })).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("does not offer archive when the list fails to load", async () => {
    listCourses.mockResolvedValue({ ok: false, message: "Could not load courses." });

    render(<ArchiveCoursesScreen />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load courses.");
    expect(screen.queryByRole("button", { name: "Archive" })).not.toBeInTheDocument();
    expect(
      screen.queryByText("No published courses are available to archive."),
    ).not.toBeInTheDocument();
  });
});
