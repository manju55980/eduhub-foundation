import { createFileRoute } from "@tanstack/react-router";
import { EduHubLanding } from "@/components/landing/eduhub-landing";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "EduHub — Courses, submissions and grades in one calm place" },
      {
        name: "description",
        content:
          "EduHub is a small learning platform with dedicated spaces for students, instructors and admins. Choose your role to explore.",
      },
      {
        property: "og:title",
        content: "EduHub — Courses, submissions and grades in one calm place",
      },
      {
        property: "og:description",
        content:
          "A small learning platform with dedicated spaces for students, instructors and admins.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EduHubLanding,
});
