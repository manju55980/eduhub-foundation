import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Presentation } from "lucide-react";

export const Route = createFileRoute("/instructor")({
  head: () => ({
    meta: [
      { title: "Instructor area — EduHub" },
      {
        name: "description",
        content:
          "The instructor space of EduHub: create courses, publish lessons, review submissions and grade.",
      },
      { property: "og:title", content: "Instructor area — EduHub" },
      {
        property: "og:description",
        content:
          "The instructor space of EduHub: courses, lessons, submissions and grading.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InstructorPlaceholder,
});

function InstructorPlaceholder() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-instructor-soft px-6">
      <div className="max-w-md rounded-3xl border border-border bg-card p-10 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <Presentation className="size-7" />
        </div>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight text-foreground">
          Instructor area
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          This space arrives with the next phase — sign-in, course authoring
          and grading. The navigation for the instructor dashboard, Create
          course, My courses, Submissions and My profile is planned here.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
        >
          <ArrowLeft className="size-4" />
          Back to the landing page
        </Link>
      </div>
    </div>
  );
}
