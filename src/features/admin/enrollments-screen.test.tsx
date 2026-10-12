import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { EnrollmentsScreen } from "./enrollments-screen";
import { listAllEnrollments } from "./enrollments-api";

vi.mock("./enrollments-api", () => ({
  listAllEnrollments: vi.fn(),
}));

const listEnrollments = vi.mocked(listAllEnrollments);

const enrollment = {
  id: "enrollment-1",
  studentName: "Ada Lovelace",
  title: "Archived course",
  courseStatus: "archived",
  progress: 40,
  enrollmentStatus: "active",
  enrolledAt: "2026-10-10T00:00:00.000Z",
};

describe("EnrollmentsScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows an empty list without an enrollment control", async () => {
    listEnrollments.mockResolvedValue({ ok: true, enrollments: [] });

    render(<EnrollmentsScreen />);

    expect(screen.getByText("Loading enrollments…")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /unenroll|progress|delete|archive|approve/i }),
    ).not.toBeInTheDocument();
    expect(await screen.findByText("There are no enrollments yet.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "All Enrollments" })).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows an enrollment in an archived course without a write control", async () => {
    listEnrollments.mockResolvedValue({ ok: true, enrollments: [enrollment] });

    render(<EnrollmentsScreen />);

    const row = (await screen.findByRole("heading", { name: "Archived course" })).closest(
      "article",
    );
    expect(row).not.toBeNull();
    const view = within(row as HTMLElement);
    expect(view.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(view.getByText("Archived")).toBeInTheDocument();
    expect(view.getByText("Active")).toBeInTheDocument();
    expect(view.getByText("Enrolled")).toBeInTheDocument();
    expect(screen.queryByText("Progress")).not.toBeInTheDocument();
    expect(screen.queryByText("40%")).not.toBeInTheDocument();
    expect(screen.queryByText("Still available")).not.toBeInTheDocument();
    expect(screen.queryByText("Advanced")).not.toBeInTheDocument();
    expect(screen.queryByText("Level")).not.toBeInTheDocument();
    expect(screen.queryByText("Created")).not.toBeInTheDocument();
    expect(screen.queryByText(/grade|feedback|lesson|email/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /unenroll|progress|delete|archive|approve/i }),
    ).not.toBeInTheDocument();
  });

  it("shows a blank course title and a blank student name", async () => {
    listEnrollments.mockResolvedValue({
      ok: true,
      enrollments: [
        {
          ...enrollment,
          studentName: null,
          title: null,
          courseStatus: "published",
          progress: 100,
          enrollmentStatus: "completed",
        },
      ],
    });

    render(<EnrollmentsScreen />);

    expect(await screen.findByText("Completed")).toBeInTheDocument();
    expect(screen.queryByText("Progress")).not.toBeInTheDocument();
    expect(screen.queryByText("100%")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Archived course" })).not.toBeInTheDocument();
    expect(screen.queryByText("Ada Lovelace")).not.toBeInTheDocument();
  });

  it("does not show cards when enrollments fail to load", async () => {
    listEnrollments.mockResolvedValue({ ok: false, message: "Could not load enrollments." });

    render(<EnrollmentsScreen />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load enrollments.");
    expect(screen.queryByText("Archived course")).not.toBeInTheDocument();
    expect(screen.queryByText("Ada Lovelace")).not.toBeInTheDocument();
    expect(screen.queryByText("40%")).not.toBeInTheDocument();
  });
});
