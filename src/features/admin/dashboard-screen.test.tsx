import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { listPendingCourses } from "./approve-courses-api";
import { AdminDashboardScreen } from "./dashboard-screen";
import { listAllEnrollments } from "./enrollments-api";

vi.mock("./approve-courses-api", () => ({
  listPendingCourses: vi.fn(),
}));

vi.mock("./enrollments-api", () => ({
  listAllEnrollments: vi.fn(),
}));

const listCourses = vi.mocked(listPendingCourses);
const listEnrollments = vi.mocked(listAllEnrollments);

const pendingCourse = {
  id: "course-1",
  title: "Algebra",
  description: "Core skills.",
  level: "beginner",
  instructorName: "Grace Hopper",
  createdAt: "2026-10-09T00:00:00.000Z",
  lessons: [],
};

function enrollment(id: string, title: string, enrolledAt: string) {
  return {
    id,
    studentName: "Ada Lovelace",
    title,
    courseStatus: "published",
    progress: 40,
    enrollmentStatus: "active",
    enrolledAt,
  };
}

describe("AdminDashboardScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listCourses.mockResolvedValue({ ok: true, courses: [] });
    listEnrollments.mockResolvedValue({ ok: true, enrollments: [] });
  });

  it("greets the signed-in admin and shows empty overview sections", async () => {
    render(<AdminDashboardScreen fullName="  Ada Lovelace  " />);

    expect(screen.getByText("Loading dashboard…")).toBeInTheDocument();
    expect(await screen.findByText("No courses are waiting for approval.")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Welcome back, Ada Lovelace" }),
    ).toBeInTheDocument();
    expect(screen.getByText("There are no enrollments yet.")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("uses Admin when the signed-in name is blank", async () => {
    render(<AdminDashboardScreen fullName="   " />);

    expect(await screen.findByRole("heading", { name: "Welcome back, Admin" })).toBeInTheDocument();
  });

  it("shows pending courses and only the four newest enrollments", async () => {
    listCourses.mockResolvedValue({ ok: true, courses: [pendingCourse] });
    listEnrollments.mockResolvedValue({
      ok: true,
      enrollments: [
        enrollment("enrollment-1", "Newest", "2026-10-10T00:00:00.000Z"),
        enrollment("enrollment-2", "Second", "2026-10-09T00:00:00.000Z"),
        enrollment("enrollment-3", "Third", "2026-10-08T00:00:00.000Z"),
        enrollment("enrollment-4", "Fourth", "2026-10-07T00:00:00.000Z"),
        enrollment("enrollment-5", "Older", "2026-10-06T00:00:00.000Z"),
      ],
    });

    render(<AdminDashboardScreen fullName="Ada" />);

    const course = (await screen.findByRole("heading", { name: "Algebra" })).closest("article");
    expect(course).not.toBeNull();
    const courseView = within(course as HTMLElement);
    expect(courseView.getByText("Pending")).toBeInTheDocument();
    expect(courseView.getByText("Grace Hopper")).toBeInTheDocument();
    expect(courseView.queryByText("Core skills.")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Newest" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Fourth" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Older" })).not.toBeInTheDocument();
    expect(screen.queryByText("Progress")).not.toBeInTheDocument();
    expect(screen.queryByText("40%")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /approve|archive|promote/i }),
    ).not.toBeInTheDocument();
  });

  it("hides a section when its query fails and keeps the other", async () => {
    listCourses.mockResolvedValue({ ok: false, message: "courses unavailable" });
    listEnrollments.mockResolvedValue({
      ok: true,
      enrollments: [enrollment("enrollment-1", "Newest", "2026-10-10T00:00:00.000Z")],
    });

    render(<AdminDashboardScreen fullName="Ada" />);

    expect(await screen.findByText("courses unavailable")).toBeInTheDocument();
    expect(screen.queryByText("No courses are waiting for approval.")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Newest" })).toBeInTheDocument();
  });
});
