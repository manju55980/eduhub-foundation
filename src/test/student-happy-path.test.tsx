import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { studentJourneyMemory } from "./memory-supabase";

vi.mock("@/integrations/supabase/client", async () => {
  const { studentJourneyMemory: memory } = await import("./memory-supabase");
  return { supabase: memory.supabase };
});

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    params,
  }: {
    children?: ReactNode;
    to?: string;
    params?: { courseId?: string };
  }) => (
    <a href={params?.courseId ? `/student/my-courses/${params.courseId}` : (to ?? "#")}>
      {children}
    </a>
  ),
}));

import { NotificationBell } from "@/features/notifications/notification-bell";
import { AssignmentsScreen } from "@/features/student/assignments-screen";
import { BrowseCoursesScreen } from "@/features/student/browse-courses-screen";
import { CourseLearningScreen } from "@/features/student/course-learning-screen";
import { MyCoursesScreen } from "@/features/student/my-courses-screen";

const studentId = "student-e2e";

describe("student happy path", () => {
  beforeEach(() => {
    studentJourneyMemory.seedStudentJourney();
  });

  afterEach(() => {
    cleanup();
    studentJourneyMemory.reset();
    expect(studentJourneyMemory.tables.enrollments).toEqual([]);
    expect(studentJourneyMemory.tables.submissions).toEqual([]);
    expect(studentJourneyMemory.tables.lesson_completions).toEqual([]);
    expect(studentJourneyMemory.tables.certificates).toEqual([]);
    expect(studentJourneyMemory.tables.notifications).toEqual([]);
  });

  it("enrolls, finishes the lesson, submits the assignment, and marks the notice read", async () => {
    const browse = render(<BrowseCoursesScreen studentId={studentId} />);

    expect(await screen.findByRole("heading", { name: "Fractions studio" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Draft only" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Enroll" }));

    expect(await screen.findByText("You are enrolled in this course.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open course" })).toHaveAttribute(
      "href",
      "/student/my-courses/course-e2e",
    );
    browse.unmount();

    const learning = render(<CourseLearningScreen courseId="course-e2e" studentId={studentId} />);
    expect(await screen.findByRole("heading", { name: "Halves" })).toBeInTheDocument();
    expect(screen.getByText("Split one into two.")).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "Mark complete" }));

    expect(await screen.findByText("This lesson is complete.")).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.getByText(/Certificate issued/)).toHaveTextContent("Fractions studio");
    expect(screen.queryByRole("button", { name: "Mark complete" })).not.toBeInTheDocument();
    learning.unmount();

    const assignments = render(<AssignmentsScreen studentId={studentId} />);
    expect(await screen.findByRole("heading", { name: "Practice sheet" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Submission/), {
      target: { value: "One half plus one half is one." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByText("This assignment was submitted.")).toBeInTheDocument();
    expect(screen.getByText("Submitted")).toBeInTheDocument();
    expect(screen.getByText("One half plus one half is one.")).toBeInTheDocument();
    assignments.unmount();

    render(
      <>
        <NotificationBell userId={studentId} role="student" />
        <MyCoursesScreen studentId={studentId} />
      </>,
    );
    expect(await screen.findByRole("heading", { name: "Fractions studio" })).toBeInTheDocument();
    expect(screen.getByText(/Certificate issued/)).toHaveTextContent("Fractions studio");
    fireEvent.click(await screen.findByRole("button", { name: /Notifications/ }));
    expect(await screen.findByText("Course complete")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mark read" }));

    expect(await screen.findByText("Notification marked read.")).toBeInTheDocument();
    expect(screen.getByText("Read")).toBeInTheDocument();
    expect(
      studentJourneyMemory.tables.notifications.some(
        (row) =>
          row.kind === "student_completed_course" &&
          row.recipient_id === "instructor-e2e" &&
          row.body === "Fractions studio",
      ),
    ).toBe(true);
    expect(studentJourneyMemory.tables.submissions).toEqual([
      expect.objectContaining({
        student_id: studentId,
        assignment_id: "assignment-e2e",
        content_url: "One half plus one half is one.",
        status: "submitted",
      }),
    ]);
  });
});
