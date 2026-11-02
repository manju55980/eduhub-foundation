import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApproveCoursesScreen } from "./approve-courses-screen";
import { listPendingCourses, publishCourse } from "./approve-courses-api";
import { listNewestCourseReviews, requestCourseReview } from "./course-review-api";
import type { CourseReview } from "./course-review";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children?: ReactNode; to?: string }) => (
    <a href={to ?? "#"}>{children}</a>
  ),
}));

vi.mock("./approve-courses-api", () => ({
  listPendingCourses: vi.fn(),
  publishCourse: vi.fn(),
}));

vi.mock("./course-review-api", () => ({
  listNewestCourseReviews: vi.fn(async () => ({ ok: true, reviews: [] })),
  requestCourseReview: vi.fn(),
}));

vi.mock("@/features/instructor/course-materials-api", () => ({
  listMaterialsForCourses: vi.fn(async () => ({ ok: true, materials: [] })),
  createMaterialDownloadUrl: vi.fn(),
}));

const listCourses = vi.mocked(listPendingCourses);
const publish = vi.mocked(publishCourse);
const listReviews = vi.mocked(listNewestCourseReviews);
const requestReview = vi.mocked(requestCourseReview);

const course = {
  id: "course-1",
  title: "Intro to React",
  description: "Basics",
  level: "beginner",
  instructorName: "Ada Lovelace",
  createdAt: "2026-10-10T00:00:00.000Z",
  lessons: [
    {
      id: "lesson-1",
      title: "Welcome",
      content: "Start here.",
      videoUrl: null,
      orderIndex: 1,
      createdAt: "2026-10-10T00:00:00.000Z",
    },
  ],
};

describe("ApproveCoursesScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listReviews.mockResolvedValue({ ok: true, reviews: [] });
  });

  it("shows an empty list without an approve control", async () => {
    listCourses.mockResolvedValue({ ok: true, courses: [] });

    render(<ApproveCoursesScreen />);

    expect(await screen.findByRole("heading", { name: "Approve Courses" })).toBeInTheDocument();
    expect(screen.getByText("No courses are waiting for approval.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Archive a published course" })).toHaveAttribute(
      "href",
      "/admin/courses/archive",
    );
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Archive" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Review with AI" })).not.toBeInTheDocument();
    expect(requestReview).not.toHaveBeenCalled();
  });

  it("shows a pending course and its lessons without other status controls", async () => {
    listCourses.mockResolvedValue({ ok: true, courses: [course] });

    render(<ApproveCoursesScreen />);

    expect(await screen.findByRole("heading", { name: "Intro to React" })).toBeInTheDocument();
    expect(screen.getByText("Basics")).toBeInTheDocument();
    expect(screen.getByText("Beginner")).toBeInTheDocument();
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Welcome" })).toBeInTheDocument();
    expect(screen.getByText("Start here.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /video|http/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /archive|reject|delete|edit/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Review with AI" })).toBeInTheDocument();
    expect(requestReview).not.toHaveBeenCalled();
  });

  it("opens an http video URL in a new tab and omits a value that is not a web URL", async () => {
    const lesson = course.lessons[0];
    if (!lesson) throw new Error("The fixture course has no lesson.");

    listCourses.mockResolvedValue({
      ok: true,
      courses: [
        {
          ...course,
          lessons: [
            { ...lesson, videoUrl: " https://video.example/lesson " },
            {
              ...lesson,
              id: "lesson-2",
              title: "Notes",
              videoUrl: "javascript:alert(1)",
            },
          ],
        },
      ],
    });

    render(<ApproveCoursesScreen />);

    const video = await screen.findByRole("link", { name: "https://video.example/lesson" });
    expect(video).toHaveAttribute("href", "https://video.example/lesson");
    expect(video).toHaveAttribute("target", "_blank");
    expect(screen.queryByRole("link", { name: "javascript:alert(1)" })).not.toBeInTheDocument();
  });

  it("publishes the course and removes it from the pending list", async () => {
    listCourses.mockResolvedValue({ ok: true, courses: [course] });
    publish.mockResolvedValue({ ok: true });

    render(<ApproveCoursesScreen />);

    fireEvent.click(await screen.findByRole("button", { name: "Approve" }));

    await waitFor(() => expect(publish).toHaveBeenCalledWith("course-1"));
    expect(await screen.findByRole("status")).toHaveTextContent("This course was published.");
    expect(screen.queryByRole("heading", { name: "Intro to React" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Approve Courses" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
  });

  it("leaves the course pending when publish fails", async () => {
    listCourses.mockResolvedValue({ ok: true, courses: [course] });
    publish.mockResolvedValue({ ok: false, message: "admins can change only course status" });

    render(<ApproveCoursesScreen />);

    fireEvent.click(await screen.findByRole("button", { name: "Approve" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "admins can change only course status",
    );
    expect(screen.getByRole("heading", { name: "Intro to React" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve" })).toBeInTheDocument();
  });

  it("does not offer approve when the list fails to load", async () => {
    listCourses.mockResolvedValue({ ok: false, message: "Could not load courses." });

    render(<ApproveCoursesScreen />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load courses.");
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
  });

  it("shows a saved review without calling the function", async () => {
    listCourses.mockResolvedValue({ ok: true, courses: [course] });
    listReviews.mockResolvedValue({ ok: true, reviews: [savedReview()] });

    render(<ApproveCoursesScreen />);

    expect(await screen.findByText("Revise")).toBeInTheDocument();
    expect(screen.getByText("Low confidence")).toBeInTheDocument();
    expect(screen.getByText("Add a practice task.")).toBeInTheDocument();
    expect(screen.getByText("The last lesson jumps ahead.")).toBeInTheDocument();
    expect(screen.getByText("0.69")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve" })).toBeEnabled();
    expect(requestReview).not.toHaveBeenCalled();
  });

  it("keeps approve available while a review runs, fails, and is retried", async () => {
    listCourses.mockResolvedValue({ ok: true, courses: [course] });
    let resolveReview: (value: Awaited<ReturnType<typeof requestCourseReview>>) => void = () => {};
    requestReview.mockReturnValue(
      new Promise((resolve) => {
        resolveReview = resolve;
      }),
    );

    render(<ApproveCoursesScreen />);

    fireEvent.click(await screen.findByRole("button", { name: "Review with AI" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Reviewing…" })).toBeDisabled());
    expect(screen.getByRole("button", { name: "Approve" })).toBeEnabled();
    expect(requestReview).toHaveBeenCalledTimes(1);
    expect(requestReview).toHaveBeenCalledWith("course-1");

    resolveReview({ ok: false, message: "The AI request failed." });
    expect(await screen.findByRole("alert")).toHaveTextContent("The AI request failed.");
    expect(screen.getByRole("button", { name: "Approve" })).toBeEnabled();
    const retry = screen.getByRole("button", { name: "Review with AI" });
    expect(retry).toBeEnabled();

    requestReview.mockResolvedValue({
      ok: true,
      review: {
        ...savedReview(),
        recommendation: "recommend",
        confidence: 0.91,
        lowConfidence: false,
      },
    });
    fireEvent.click(retry);
    expect(await screen.findByRole("status")).toHaveTextContent("This review was saved.");
    expect(screen.getByText("Recommend")).toBeInTheDocument();
    expect(screen.queryByText("Low confidence")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve" })).toBeEnabled();
    expect(publish).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByText("This review was saved.")).not.toBeInTheDocument();
    expect(screen.getByText("Add a practice task.")).toBeInTheDocument();
  });

  it("keeps approve available when saved reviews fail to load", async () => {
    listCourses.mockResolvedValue({ ok: true, courses: [course] });
    listReviews.mockResolvedValue({ ok: false, message: "Could not load reviews." });

    render(<ApproveCoursesScreen />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load reviews.");
    expect(screen.getByRole("button", { name: "Approve" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Review with AI" })).toBeEnabled();
  });
});

function savedReview(): CourseReview {
  return {
    id: "review-1",
    courseId: "course-1",
    recommendation: "revise",
    confidence: 0.69,
    summary: "Add a practice task.",
    findings: ["The last lesson jumps ahead."],
    createdAt: "2026-11-02T00:00:00.000Z",
    lowConfidence: true,
  };
}
