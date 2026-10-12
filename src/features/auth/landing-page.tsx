import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  GraduationCap,
  Presentation,
  ShieldCheck,
} from "lucide-react";

const roleAreas = [
  {
    name: "Student",
    icon: GraduationCap,
    soft: { backgroundColor: "var(--student-soft, #d3efff)" },
    tone: "text-primary",
    to: "/student",
    description:
      "Browse the catalogue, keep your enrolled courses together, submit assignments and track your grades.",
    items: ["Browse courses", "My courses", "Assignments", "My grades", "My profile"],
  },
  {
    name: "Instructor",
    icon: Presentation,
    soft: { backgroundColor: "var(--instructor-soft, #d6f7e0)" },
    tone: "text-accent-foreground",
    to: "/instructor",
    description:
      "Create courses, publish lessons, review submissions and record the grades that reach your students.",
    items: ["Instructor dashboard", "Create a course", "My courses", "Submissions", "My profile"],
  },
  {
    name: "Admin",
    icon: ShieldCheck,
    soft: { backgroundColor: "var(--admin-soft, #ffeacf)" },
    tone: "text-foreground",
    to: "/admin",
    description:
      "Review submitted courses, manage users and categories, and keep an eye on enrollments across the platform.",
    items: ["Admin dashboard", "Course approvals", "Manage users", "Manage categories", "Reports"],
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
            course has a natural home.
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

        <section className="pb-8 pt-12">
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

        <footer className="mt-auto border-t border-border py-6 text-center text-xs text-muted-foreground">
          Better learning builds brighter futures.
        </footer>
      </div>
    </div>
  );
}
