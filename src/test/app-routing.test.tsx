import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";

// Match routes without running loaders or rendering: loaders may need a server or
// network the test run lacks, and jsdom never loads the stylesheets React waits on.
describe("App routing", () => {
  it("matches a page for / instead of falling back to not found", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

    const matches = router.matchRoutes("/");

    expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
  });

  it("matches auth and role routes", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

    for (const path of [
      "/auth",
      "/student",
      "/student/courses",
      "/student/my-courses",
      "/student/my-courses/course-1",
      "/student/assignments",
      "/student/grades",
      "/student/profile",
      "/instructor",
      "/instructor/courses",
      "/instructor/courses/new",
      "/instructor/courses/course-1/lessons",
      "/instructor/courses/course-1/assignments",
      "/instructor/submissions",
      "/instructor/profile",
      "/admin",
      "/admin/courses/approvals",
      "/admin/courses/archive",
      "/admin/users",
      "/admin/categories",
      "/admin/enrollments",
      "/admin/reports",
    ]) {
      const matches = router.matchRoutes(path);
      expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
    }
  });
});
