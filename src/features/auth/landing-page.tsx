import { Link } from "@tanstack/react-router";
import {
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

const controlFocus =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

const roleAreas = [
  {
    name: "Student",
    icon: GraduationCap,
    soft: "bg-student-soft",
    tone: "text-foreground",
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
    soft: "bg-instructor-soft",
    tone: "text-foreground",
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
    soft: "bg-admin-soft",
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
    soft: "bg-student-soft",
    tone: "text-foreground",
    detail:
      "On an enrolled course, ask one question. The answer is an explanation, an example, and practice questions. The chat is saved.",
  },
  {
    audience: "Student",
    name: "Learning Assistant",
    icon: MessagesSquare,
    soft: "bg-student-soft",
    tone: "text-foreground",
    detail:
      "Ask about a published course, a recommendation, your grades, or the next course. Course answers come from the stored catalogue. It can enrol you in a published course. The chat is saved.",
  },
  {
    audience: "Instructor",
    name: "AI Course Builder",
    icon: Sparkles,
    soft: "bg-instructor-soft",
    tone: "text-foreground",
    detail:
      "Describe a course and choose a level. Review the outline, lessons, assignment questions, and any video suggestions, then save them as a new draft.",
  },
] as const;

const afterEnrollment = [
  {
    icon: CheckCircle2,
    title: "Mark a lesson complete",
    detail:
      "Each enrolled lesson can be marked complete once. Progress reaches 100 only when every lesson is done.",
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
            <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <GraduationCap className="size-5" />
            </div>
            <span className="font-display text-xl font-semibold text-primary">EduHub</span>
          </div>
          {checking ? (
            <span className="rounded-md border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              Checking session…
            </span>
          ) : (
            <Link
              to="/auth"
              className={`inline-flex h-9 items-center rounded-md border border-input bg-background px-4 text-sm font-medium text-foreground transition-[color,background-color,border-color,box-shadow] duration-150 ease-standard hover:bg-sage motion-reduce:transition-none ${controlFocus}`}
            >
              Sign in
            </Link>
          )}
        </header>

        <section className="grid flex-1 items-start gap-10 py-10 lg:grid-cols-[minmax(0,1.5fr)_16rem] lg:py-16">
          <div className="max-w-[40rem]">
            <h1 className="text-3xl font-semibold leading-[1.15] text-foreground sm:text-4xl">
              <span className="mark-line">
                Courses, submissions and grades — in one calm place.
              </span>
            </h1>
            <p className="mt-5 max-w-[62ch] text-base leading-relaxed text-muted-foreground sm:text-lg">
              EduHub gives students, instructors and admins their own clear spaces, so every part of
              a course has a natural home. Students can ask the Study Companion or the Learning
              Assistant, and instructors can draft a course with the AI Course Builder. A finished
              course brings a certificate and a notice.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                to="/student"
                className={`inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-raised transition-[color,background-color,border-color,box-shadow] duration-150 ease-standard hover:bg-primary-hover motion-reduce:transition-none ${controlFocus}`}
              >
                Start as a student
              </Link>
              <a
                href="#roles"
                className={`inline-flex h-9 items-center rounded-md border border-input bg-background px-4 text-sm font-medium text-foreground transition-[color,background-color,border-color,box-shadow] duration-150 ease-standard hover:bg-sage motion-reduce:transition-none ${controlFocus}`}
              >
                Choose your role
              </a>
            </div>
          </div>
          <aside className="max-w-[28ch] border-t border-border pt-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-1">
            <p className="text-xl leading-snug text-foreground">One catalogue. Three rooms.</p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Students keep a shelf. Instructors mark the work. Admins decide what is published.
            </p>
          </aside>
        </section>

        <section id="roles" className="scroll-mt-8 pb-4 pt-8">
          <h2 className="text-2xl font-semibold text-foreground">
            Three clear areas, one platform
          </h2>
          <p className="mt-2 max-w-[62ch] text-sm leading-relaxed text-muted-foreground">
            Each role sees only what it needs — nothing more.
          </p>
          <div className="mt-6 grid border border-border bg-card lg:grid-cols-3 lg:divide-x lg:divide-border">
            {roleAreas.map((role) => (
              <Link
                key={role.name}
                to={role.to}
                className={`flex flex-col border-b border-border p-5 last:border-b-0 lg:border-b-0 ${controlFocus}`}
              >
                <div className={`flex size-8 items-center justify-center rounded-md ${role.soft}`}>
                  <role.icon className={`size-4 ${role.tone}`} />
                </div>
                <h3 className="mt-4 text-xl font-medium text-foreground">{role.name}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {role.description}
                </p>
                <ul className="mt-5 space-y-1.5">
                  {role.items.map((item) => (
                    <li key={item} className="text-sm text-muted-foreground">
                      {item}
                    </li>
                  ))}
                </ul>
                <span className="mt-6 text-sm font-medium text-primary">
                  Open {role.name.toLowerCase()} area
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section className="pb-4 pt-12">
          <h2 className="text-2xl font-semibold text-foreground">AI agents</h2>
          <p className="mt-2 max-w-[62ch] text-sm leading-relaxed text-muted-foreground">
            Study Companion and Learning Assistant for students, and AI Course Builder for
            instructors.
          </p>
          <div className="mt-6 divide-y divide-border border border-border bg-card">
            {agents.map((agent) => (
              <div key={agent.name} className="grid gap-4 p-5 sm:grid-cols-[11rem_minmax(0,1fr)]">
                <div className="flex items-start gap-3">
                  <div
                    className={`flex size-8 shrink-0 items-center justify-center rounded-md ${agent.soft}`}
                  >
                    <agent.icon className={`size-4 ${agent.tone}`} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{agent.audience}</p>
                    <h3 className="text-lg font-medium text-foreground">{agent.name}</h3>
                  </div>
                </div>
                <p className="max-w-[68ch] text-sm leading-relaxed text-muted-foreground">
                  {agent.detail}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="pb-4 pt-12">
          <h2 className="text-2xl font-semibold text-foreground">
            How a course moves through EduHub
          </h2>
          <p className="mt-2 max-w-[62ch] text-sm leading-relaxed text-muted-foreground">
            One shared workflow, five steps.
          </p>
          <ol className="mt-8 grid gap-8 border-l-2 border-primary pl-5 lg:grid-cols-5 lg:gap-4 lg:border-l-0 lg:border-t-2 lg:pl-0 lg:pt-5">
            {flow.map((step, index) => (
              <li key={step.title}>
                <p className="text-2xl text-primary">{index + 1}</p>
                <h3 className="mt-2 text-base font-medium text-foreground">{step.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{step.detail}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="pb-8 pt-12">
          <h2 className="text-2xl font-semibold text-foreground">After a student enrolls</h2>
          <p className="mt-2 max-w-[62ch] text-sm leading-relaxed text-muted-foreground">
            Lesson completion, a certificate, and notices sit on top of the five steps above.
          </p>
          <div className="mt-6 divide-y divide-border border border-border bg-card">
            {afterEnrollment.map((item) => (
              <div key={item.title} className="grid gap-3 p-5 sm:grid-cols-[auto_minmax(0,1fr)]">
                <item.icon className="size-4 text-primary" />
                <div>
                  <h3 className="text-base font-medium text-foreground">{item.title}</h3>
                  <p className="mt-1 max-w-[68ch] text-sm leading-relaxed text-muted-foreground">
                    {item.detail}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <footer className="mt-auto border-t border-border py-6 text-sm text-muted-foreground">
          Better learning builds brighter futures.
        </footer>
      </div>
    </div>
  );
}
