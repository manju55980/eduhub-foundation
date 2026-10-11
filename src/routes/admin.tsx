import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin area — EduHub" },
      {
        name: "description",
        content:
          "The admin space of EduHub: approve courses, manage users, categories, enrolments and reports.",
      },
      { property: "og:title", content: "Admin area — EduHub" },
      {
        property: "og:description",
        content:
          "The admin space of EduHub: approvals, users, categories and reports.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPlaceholder,
});

function AdminPlaceholder() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-admin-soft px-6">
      <div className="max-w-md rounded-3xl border border-border bg-card p-10 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <ShieldCheck className="size-7" />
        </div>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight text-foreground">
          Admin area
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          This space arrives with the next phase — sign-in, approvals and
          reports. The navigation for the admin dashboard, Approve courses,
          Manage users, Manage categories and Reports is planned here.
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
