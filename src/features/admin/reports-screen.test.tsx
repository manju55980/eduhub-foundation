import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { listAllEnrollments } from "./enrollments-api";
import { ReportsScreen } from "./reports-screen";

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("./enrollments-api", () => ({
  listAllEnrollments: vi.fn(),
}));

const listEnrollments = vi.mocked(listAllEnrollments);

function enrollment(
  id: string,
  title: string | null,
  enrolledAt: string,
  courseStatus: string | null = "published",
) {
  return {
    id,
    courseId: "course-1",
    studentName: "Ada Lovelace",
    title,
    courseStatus,
    progress: 40,
    enrollmentStatus: "active",
    enrolledAt,
  };
}

describe("ReportsScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows an empty report without a link or control", async () => {
    listEnrollments.mockResolvedValue({ ok: true, enrollments: [] });

    render(<ReportsScreen />);

    expect(screen.getByText("Loading reports…")).toBeInTheDocument();
    expect(await screen.findByText("There are no enrollments yet.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Reports" })).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("lists every enrollment, including one in an archived course", async () => {
    listEnrollments.mockResolvedValue({
      ok: true,
      enrollments: [
        enrollment("enrollment-1", "Newest", "2026-10-10T00:00:00.000Z", "archived"),
        enrollment("enrollment-2", "Older", "2026-10-06T00:00:00.000Z"),
      ],
    });

    render(<ReportsScreen />);

    expect(await screen.findByRole("heading", { name: "Newest" })).toBeInTheDocument();
    const row = screen.getByRole("heading", { name: "Newest" }).closest("tr");
    expect(row).not.toBeNull();
    const view = within(row as HTMLElement);
    expect(view.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(view.getByText("Course")).toBeInTheDocument();
    expect(view.getByText("Student")).toBeInTheDocument();
    expect(view.getByText("Archived")).toBeInTheDocument();
    expect(view.getByText("Active")).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Progress" })).not.toBeInTheDocument();
    expect(view.queryByText("40%")).not.toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Enrolled" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Older" })).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("shows a blank course title when the title is missing", async () => {
    listEnrollments.mockResolvedValue({
      ok: true,
      enrollments: [enrollment("enrollment-1", null, "2026-10-10T00:00:00.000Z", null)],
    });

    render(<ReportsScreen />);

    const row = (await screen.findByText("Ada Lovelace")).closest("tr");
    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).getByRole("heading")).toHaveTextContent("");
    expect(within(row as HTMLElement).queryByText("Published")).not.toBeInTheDocument();
  });

  it("shows the error and no enrollment cards when the query fails", async () => {
    listEnrollments.mockResolvedValue({ ok: false, message: "enrollments unavailable" });

    render(<ReportsScreen />);

    expect(await screen.findByText("enrollments unavailable")).toBeInTheDocument();
    expect(screen.queryByText("There are no enrollments yet.")).not.toBeInTheDocument();
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
  });
});
