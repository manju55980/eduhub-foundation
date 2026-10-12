import { describe, expect, it } from "vitest";

import { coursesInCategory } from "./catalogue";

const courses = [
  { id: "course-1", categoryId: null },
  { id: "course-2", categoryId: "category-1" },
  { id: "course-3", categoryId: "category-2" },
];

describe("coursesInCategory", () => {
  it("keeps every published course, including those with no category, until one is chosen", () => {
    expect(coursesInCategory(courses, "").map((course) => course.id)).toEqual([
      "course-1",
      "course-2",
      "course-3",
    ]);
  });

  it("keeps only courses in the chosen category", () => {
    expect(coursesInCategory(courses, "category-1").map((course) => course.id)).toEqual([
      "course-2",
    ]);
  });
});
