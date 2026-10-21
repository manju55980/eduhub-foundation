import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Award,
  Bell,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  GraduationCap,
  MessagesSquare,
  Presentation,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

const roleAreas = [
  {
    name: "Student",
    icon: GraduationCap,
    soft: { backgroundColor: "var(--student-soft, #d3efff)" },
    tone: "text-primary",
    to: "/student",
    description:
      "Browse the catalogue, keep your enrolled courses together, ask the Study Companion about a course you have joined, ask the Learning Assistant for a recommendation, submit assignments, track your grades, and open a certificate when every lesson is complete.",
    items: [
      "Browse courses",
      "My courses",
      "Study Companion",
      "Learning Assistant",
      "Assignments",
      "My grades",
      "My certificates",
      "My profile",
    ],
  },
  {
    name: "Instructor",
    icon: Presentation,
    soft: { backgroundColor: "var(--instructor-soft, #d6f7e0)" },
    tone: "text-accent-foreground",
    to: "/instructor",
    description:
      "Create a course by hand or with the AI Course Builder, publish lessons, review submissions, record the grades that reach your students, and read a notice when one of your students finishes a course.",
    items: [
      "Instructor dashboard",
      "Create a course",
      "AI Course Builder",
      "My courses",
      "Lessons",
      "Submissions",
      "My profile",
    ],
  },
  {
    name: "Admin",
    icon: ShieldCheck,
    soft: { backgroundColor: "var(--admin-soft, #ffeacf)" },
    tone: "text-foreground",
    to: "/admin",
    description:
      "Review submitted courses, archive a published course, manage users and categories, and keep an eye on enrollments and reports across the platform.",
    items: [
      "Admin dashboard",
      "Course approvals",
      "Archive courses",
      "Manage users",
      "Manage categories",
      "All enrollments",
      "Reports",
    ],
  },
] as const;

const flow = [
  {
    icon: BookOpen,
    title: "Instructor creates a course",
    detail: "A new course starts as a draft waiting for review.",
  },
  {
    icon: ShieldCheck,
    title: "Admin reviews and publishes",
    detail: "Approved courses appear in the student catalogue.",
  },
  {
    icon: GraduationCap,
    title: "Student enrolls",
    detail: "Enrolled courses move into the student's shelf.",
  },
  {
    icon: ClipboardCheck,
    title: "Student submits work",
    detail: "Assignments land in the instructor's queue.",
  },
  {
    icon: CheckCircle2,
    title: "Instructor grades",
    detail: "Grades flow back to the student's grade page.",
  },
] as const;

const agents = [
  {
    audience: "Student",
    name: "Study Companion",
    icon: Sparkles,
    soft: { backgroundColor: "var(--student-soft, #d3efff)" },
    tone: "text-primary",
    detail:
      "On an enrolled course, ask one question. The answer is an explanation, an example, and practice questions. Nothing is saved.",
  },
  {
    audience: "Student",
    name: "Learning Assistant",
    icon: MessagesSquare,
    soft: { backgroundColor: "var(--student-soft, #d3efff)" },
    tone: "text-primary",
    detail:
      "Ask about the catalogue, a recommendation, your grades, or the next course. It can enrol you in a published course. The chat is not stored.",
  },
  {
    audience: "Instructor",
    name: "AI Course Builder",
    icon: Sparkles,
    soft: { backgroundColor: "var(--instructor-soft, #d6f7e0)" },
    tone: "text-accent-foreground",
    detail:
      "Describe a course and choose a level. Review the outline, lessons, assignment questions, and any video suggestions, then save them as a new draft.",
  },
] as const;

const afterEnrollment = [
  {
    icon: CheckCircle2,
    title: "Mark a lesson complete",
    detail: "Each enrolled lesson can be marked complete once. Progress reaches 100 only when every lesson is done.",
  },
  {
    icon: Award,
    title: "Certificate and Completed",
    detail:
      "The first time a course is finished, one certificate is issued. That course shows a green Completed label instead of Published.",
  },
  {
    icon: Bell,
    title: "Notices in the header",
    detail:
      "The student and the owning instructor get an in-app notice. Assignments due soon remind the student in the same list.",
  },
] as const;

export function LandingPage({ checking }: { checking: boolean }) {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6">
        <header className="flex items-center justify-between py-6">
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-sm bg-primary text-primary-foreground">
              <GraduationCap className="size-5" />
            </div>
            <span className="text-lg font-semibold tracking-tight text-foreground">EduHub</span>
          </div>
          {checking ? (
            <span className="rounded-sm border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              Checking session…
            </span>
          ) : (
            <Link
              to="/auth"
              className="rounded-sm border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground"
            >
              Sign in
            </Link>
          )}
        </header>

        <section className="flex flex-1 flex-col items-center justify-center py-10 text-center sm:py-14">
          <span className="rounded-sm bg-brand-soft px-3 py-1 text-xs font-medium text-foreground">
            A small learning management system
          </span>
          <h1 className="mt-4 max-w-3xl text-3xl font-semibold leading-tight tracking-tight text-foreground sm:text-4xl">
            Courses, submissions and grades — in one calm place.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            EduHub gives students, instructors and admins their own clear spaces, so every part of a
            course has a natural home. Students can ask the Study Companion or the Learning
            Assistant, and instructors can draft a course with the AI Course Builder. A finished
            course brings a certificate and a notice.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/student"
              className="inline-flex items-center gap-2 rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Start as a student
              <ArrowRight className="size-4" />
            </Link>
            <a
              href="#roles"
              className="inline-flex items-center gap-2 rounded-sm border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              Choose your role
            </a>
          </div>
        </section>

        <section id="roles" className="scroll-mt-8 pb-4">
          <div className="text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">
              Three clear areas, one platform
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Each role sees only what it needs — nothing more.
            </p>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {roleAreas.map((role) => (
              <Link
                key={role.name}
                to={role.to}
                className="group flex flex-col rounded-sm border border-border bg-card p-4"
              >
                <div
                  className="flex size-8 items-center justify-center rounded-sm"
                  style={role.soft}
                >
                  <role.icon className={`size-4 ${role.tone}`} />
                </div>
                <h3 className="mt-3 text-base font-medium text-foreground">{role.name}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {role.description}
                </p>
                <ul className="mt-5 space-y-1.5">
                  {role.items.map((item) => (
                    <li
                      key={item}
                      className="flex items-center gap-2 text-sm text-muted-foreground"
                    >
                      <span className="size-1.5 rounded-full bg-border" />
                      {item}
                    </li>
                  ))}
                </ul>
                <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
                  Open {role.name.toLowerCase()} area
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section className="pb-4 pt-12">
          <div className="text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">AI agents</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Study Companion and Learning Assistant for students, and AI Course Builder for
              instructors.
            </p>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {agents.map((agent) => (
              <div key={agent.name} className="rounded-sm border border-border bg-card p-4">
                <div className="flex items-center gap-3">
                  <div
                    className="flex size-8 items-center justify-center rounded-sm"
                    style={agent.soft}
                  >
                    <agent.icon className={`size-4 ${agent.tone}`} />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">{agent.audience}</p>
                    <h3 className="text-base font-medium text-foreground">{agent.name}</h3>
                  </div>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{agent.detail}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="pb-4 pt-12">
          <div className="text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">
              How a course moves through EduHub
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">One shared workflow, five steps.</p>
          </div>
          <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {flow.map((step, index) => (
              <li key={step.title} className="rounded-sm border border-border bg-card p-4">
                <div className="flex items-center justify-between">
                  <div className="flex size-8 items-center justify-center rounded-sm bg-secondary">
                    <step.icon className="size-4.5 text-muted-foreground" />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </div>
                <h3 className="mt-4 text-sm font-semibold text-foreground">{step.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{step.detail}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="pb-8 pt-12">
          <div className="text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">
              After a student enrolls
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Lesson completion, a certificate, and notices sit on top of the five steps above.
            </p>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {afterEnrollment.map((item) => (
              <div key={item.title} className="rounded-sm border border-border bg-card p-4">
                <div className="flex size-8 items-center justify-center rounded-sm bg-secondary">
                  <item.icon className="size-4 text-muted-foreground" />
                </div>
                <h3 className="mt-3 text-base font-medium text-foreground">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.detail}</p>
              </div>
            ))}
          </div>
        </section>

        <footer className="mt-auto border-t border-border py-6 text-center text-xs text-muted-foreground">
          Better learning builds brighter futures.
        </footer>
      </div>
    </div>
  );
}
