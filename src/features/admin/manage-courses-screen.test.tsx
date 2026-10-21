import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { archiveCourse } from "./archive-courses-api";
import { publishCourse } from "./approve-courses-api";
import { listAdminCourses } from "./manage-courses-api";
import { ManageCoursesScreen } from "./manage-courses-screen";
import {
  adminCourseEmptyMessage,
  countAdminCourses,
  filterAdminCourses,
  sortAdminCourses,
  type AdminCourse,
} from "./manage-courses";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children?: ReactNode; to?: string }) => (
    <a href={to ?? "#"}>{children}</a>
  ),
}));

vi.mock("./manage-courses-api", () => ({
  listAdminCourses: vi.fn(),
}));

vi.mock("./approve-courses-api", () => ({
  publishCourse: vi.fn(),
}));

vi.mock("./archive-courses-api", () => ({
  archiveCourse: vi.fn(),
}));

const listCourses = vi.mocked(listAdminCourses);
const publish = vi.mocked(publishCourse);
const archive = vi.mocked(archiveCourse);

function course(overrides: Partial<AdminCourse> & Pick<AdminCourse, "id" | "status">): AdminCourse {
  return {
    title: overrides.id,
    description: "A course description",
    level: "beginner",
    instructorName: "Ada Lovelace",
    createdAt: "2026-10-10T00:00:00.000Z",
    lessons: [],
    ...overrides,
  };
}

const pending = course({
  id: "pending-1",
  title: "Intro to React",
  status: "pending",
  instructorName: "Ada Lovelace",
  createdAt: "2026-10-12T00:00:00.000Z",
  lessons: [
    {
      id: "lesson-1",
      title: "Welcome",
      content: "Start here.",
      videoUrl: "https://videos.example/welcome",
      orderIndex: 1,
      createdAt: "2026-10-12T00:00:00.000Z",
    },
  ],
});

const published = course({
  id: "published-1",
  title: "Databases",
  status: "published",
  instructorName: "Grace Hopper",
  level: "intermediate",
  createdAt: "2026-10-02T00:00:00.000Z",
});

const draft = course({
  id: "draft-1",
  title: "Draft notes",
  status: "draft",
  createdAt: "2026-10-01T00:00:00.000Z",
});

const archived = course({
  id: "archived-1",
  title: "Old course",
  status: "archived",
  createdAt: "2026-09-01T00:00:00.000Z",
});

describe("admin course filters", () => {
  const courses = [pending, published, draft, archived];

  it("counts every stored status and filters by title or instructor", () => {
    expect(countAdminCourses(courses)).toEqual({
      all: 4,
      pending: 1,
      published: 1,
      draft: 1,
      archived: 1,
    });
    expect(filterAdminCourses(courses, "published", "").map((item) => item.id)).toEqual([
      "published-1",
    ]);
    expect(filterAdminCourses(courses, "all", "grace").map((item) => item.id)).toEqual([
      "published-1",
    ]);
    expect(filterAdminCourses(courses, "pending", "databases")).toEqual([]);
    expect(sortAdminCourses(courses, "oldest").map((item) => item.id)).toEqual([
      "archived-1",
      "draft-1",
      "published-1",
      "pending-1",
    ]);
    expect(adminCourseEmptyMessage("all", "  missing ")).toBe("No courses match this search.");
    expect(adminCourseEmptyMessage("pending", "")).toBe("No courses are waiting for approval.");
  });
});

describe("ManageCoursesScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the loaded courses, counts, and only the allowed action for each status", async () => {
    listCourses.mockResolvedValue({ ok: true, courses: [pending, published, draft, archived] });

    render(<ManageCoursesScreen />);

    expect(await screen.findByRole("heading", { name: "Course Management" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Total courses/ })).toHaveTextContent("4");
    expect(screen.getByRole("heading", { name: "Intro to React" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Welcome" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "https://videos.example/welcome" })).toHaveAttribute(
      "target",
      "_blank",
    );
    expect(screen.getAllByRole("button", { name: "Approve" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Archive" })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /reject/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Draft" }));
    expect(screen.getByRole("heading", { name: "Draft notes" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Archive" })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "hopper" } });
    fireEvent.click(screen.getByRole("button", { name: "All" }));
    expect(screen.getByRole("heading", { name: "Databases" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Intro to React" })).not.toBeInTheDocument();
  });

  it("publishes a pending course and archives a published course without removing the others", async () => {
    listCourses.mockResolvedValue({ ok: true, courses: [pending, published] });
    publish.mockResolvedValue({ ok: true });
    archive.mockResolvedValue({ ok: true });

    render(<ManageCoursesScreen />);

    fireEvent.click(await screen.findByRole("button", { name: "Archive" }));
    expect(await screen.findByText("This course was archived.")).toBeInTheDocument();
    expect(archive).toHaveBeenCalledWith("published-1");

    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(await screen.findByText("This course was published.")).toBeInTheDocument();
    expect(publish).toHaveBeenCalledWith("pending-1");
    expect(screen.getByRole("heading", { name: "Intro to React" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
  });

  it("shows an error without course actions", async () => {
    listCourses.mockResolvedValue({ ok: false, message: "Could not load courses." });

    render(<ManageCoursesScreen />);

    expect(await screen.findByText("Could not load courses.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Archive" })).not.toBeInTheDocument();
  });
});
