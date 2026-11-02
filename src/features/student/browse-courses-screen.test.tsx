import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BrowseCoursesScreen } from "./browse-courses-screen";
import { enrollInCourse, listPublishedCourses } from "./browse-courses-api";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    search,
  }: {
    children?: ReactNode;
    to?: string;
    search?: { from?: string };
  }) => <a href={search?.from ? `${to ?? "#"}?from=${search.from}` : (to ?? "#")}>{children}</a>,
}));

vi.mock("./browse-courses-api", () => ({
  listPublishedCourses: vi.fn(),
  enrollInCourse: vi.fn(),
}));

const listCourses = vi.mocked(listPublishedCourses);
const enroll = vi.mocked(enrollInCourse);

const course = {
  id: "course-1",
  title: "Intro to React",
  description: "Basics",
  level: "beginner",
  categoryId: null as string | null,
  createdAt: "2026-10-10T00:00:00.000Z",
  enrolled: false,
  completed: false,
  progress: null as number | null,
  completedLessons: 0,
  lessonCount: 0,
};

function loaded(courses: (typeof course)[]) {
  return {
    ok: true as const,
    courses,
    categories: [{ id: "category-1", name: "Science", createdAt: "2026-10-01T00:00:00.000Z" }],
  };
}

describe("BrowseCoursesScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows an empty catalogue without enroll actions", async () => {
    listCourses.mockResolvedValue(loaded([]));

    render(<BrowseCoursesScreen studentId="student-1" />);

    expect(await screen.findByText("No published courses are available.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Enroll" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Continue Learning" })).not.toBeInTheDocument();
  });

  it("offers enroll and hides lessons before the student joins", async () => {
    listCourses.mockResolvedValue(loaded([course]));

    render(<BrowseCoursesScreen studentId="student-1" />);

    expect(await screen.findByRole("heading", { name: "Intro to React" })).toBeInTheDocument();
    expect(screen.getByText("Basics")).toBeInTheDocument();
    expect(screen.getByText("Beginner")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enroll" })).toBeInTheDocument();
    expect(screen.getByText("Published")).toBeInTheDocument();
    expect(screen.queryByText("Completed")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Continue Learning" })).not.toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.queryByText(/instructor/i)).not.toBeInTheDocument();
  });

  it("shows a green completed label only for a course that student finished", async () => {
    listCourses.mockResolvedValue(
      loaded([
        {
          ...course,
          id: "course-done",
          title: "Finished course",
          completed: true,
          enrolled: true,
          progress: 100,
          completedLessons: 2,
          lessonCount: 2,
        },
        course,
      ]),
    );

    render(<BrowseCoursesScreen studentId="student-1" />);

    expect(await screen.findByRole("heading", { name: "Finished course" })).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.getByText("Published")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "2 of 2 lessons complete" })).toHaveAttribute(
      "aria-valuenow",
      "100",
    );
    expect(screen.queryAllByRole("progressbar")).toHaveLength(1);
  });

  it("offers open course instead of enroll when the student has already joined", async () => {
    listCourses.mockResolvedValue(
      loaded([
        {
          ...course,
          enrolled: true,
          progress: 40,
          completedLessons: 1,
          lessonCount: 3,
        },
      ]),
    );

    render(<BrowseCoursesScreen studentId="student-1" />);

    expect(await screen.findByRole("link", { name: "Continue Learning" })).toHaveAttribute(
      "href",
      "/student/my-courses/$courseId?from=browse",
    );
    expect(screen.queryByRole("button", { name: "Enroll" })).not.toBeInTheDocument();
    const meter = screen.getByRole("progressbar", { name: "1 of 3 lessons complete" });
    expect(meter).toHaveAttribute("aria-valuenow", "40");
    expect(meter.firstElementChild).toHaveStyle({ width: "40%" });
    expect(screen.getByText("40%")).toBeInTheDocument();
  });

  it("stays on the catalogue and switches the card to open course after enroll", async () => {
    listCourses
      .mockResolvedValueOnce(loaded([course]))
      .mockResolvedValue(
        loaded([
          {
            ...course,
            enrolled: true,
            progress: 0,
            completedLessons: 0,
            lessonCount: 1,
          },
        ]),
      );
    enroll.mockResolvedValue({ ok: true });

    render(<BrowseCoursesScreen studentId="student-1" />);

    fireEvent.click(await screen.findByRole("button", { name: "Enroll" }));

    await waitFor(() => expect(enroll).toHaveBeenCalledWith("student-1", "course-1"));
    expect(await screen.findByRole("status")).toHaveTextContent("You are enrolled in this course.");
    expect(screen.getByRole("link", { name: "Continue Learning" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Enroll" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Browse Courses" })).toBeInTheDocument();
    expect(
      await screen.findByRole("progressbar", { name: "0 of 1 lessons complete" }),
    ).toHaveAttribute("aria-valuenow", "0");
  });

  it("shows stored progress on enrolled cards and the updated count after reload", async () => {
    listCourses.mockResolvedValue(
      loaded([
        {
          ...course,
          enrolled: true,
          progress: 0,
          completedLessons: 0,
          lessonCount: 2,
        },
      ]),
    );

    const view = render(<BrowseCoursesScreen studentId="student-1" />);

    expect(
      await screen.findByRole("progressbar", { name: "0 of 2 lessons complete" }),
    ).toHaveAttribute("aria-valuenow", "0");
    expect(screen.getByText("0%")).toBeInTheDocument();
    view.unmount();

    listCourses.mockResolvedValue(
      loaded([
        {
          ...course,
          enrolled: true,
          progress: 50,
          completedLessons: 1,
          lessonCount: 2,
        },
      ]),
    );
    render(<BrowseCoursesScreen studentId="student-1" />);

    expect(
      await screen.findByRole("progressbar", { name: "1 of 2 lessons complete" }),
    ).toHaveAttribute("aria-valuenow", "50");
    expect(screen.getByText("50%")).toBeInTheDocument();
  });

  it("does not offer enroll when the catalogue fails to load", async () => {
    listCourses.mockResolvedValue({ ok: false, message: "Could not load courses." });

    render(<BrowseCoursesScreen studentId="student-1" />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load courses.");
    expect(screen.queryByRole("button", { name: "Enroll" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Continue Learning" })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Category" })).not.toBeInTheDocument();
  });

  it("shows a blank category and keeps an uncategorized course in the full list", async () => {
    listCourses.mockResolvedValue(
      loaded([
        course,
        {
          ...course,
          id: "course-2",
          title: "Biology",
          categoryId: "category-1",
        },
      ]),
    );

    render(<BrowseCoursesScreen studentId="student-1" />);

    expect(await screen.findByRole("heading", { name: "Intro to React" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Biology" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Category" })).toBeInTheDocument();
    const cards = screen.getAllByRole("article");
    expect(cards.map((card) => card.querySelector("dd")?.textContent)).toEqual(["", "Science"]);
  });
});
