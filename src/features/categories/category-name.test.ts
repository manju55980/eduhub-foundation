import { describe, expect, it } from "vitest";

import {
  categoriesByName,
  categoryInsert,
  categoryName,
  storedCategoryName,
} from "./category-name";

describe("categoryName", () => {
  it("stores a trimmed name and rejects a blank name", () => {
    expect(categoryName("  Science  ")).toEqual({ ok: true, name: "Science" });
    expect(categoryName("   ")).toEqual({ ok: false, message: "Enter a category name." });
  });

  it("does not impose a length limit", () => {
    const name = "A".repeat(300);
    expect(categoryName(name)).toEqual({ ok: true, name });
  });
});

describe("categoryInsert", () => {
  it("sends only the name", () => {
    expect(categoryInsert("Science")).toEqual({ name: "Science" });
    expect(Object.keys(categoryInsert("Science"))).toEqual(["name"]);
  });
});

describe("storedCategoryName", () => {
  const categories = [{ id: "category-1", name: "Science" }];

  it("returns the stored name, or blank when the course has no category", () => {
    expect(storedCategoryName(categories, "category-1")).toBe("Science");
    expect(storedCategoryName(categories, null)).toBe("");
    expect(storedCategoryName(categories, "missing")).toBe("");
  });
});

describe("categoriesByName", () => {
  it("orders labels alphabetically without changing the source list", () => {
    const categories = [
      { id: "b", name: "Science" },
      { id: "a", name: "Art" },
    ];

    expect(categoriesByName(categories).map((category) => category.name)).toEqual([
      "Art",
      "Science",
    ]);
    expect(categories.map((category) => category.name)).toEqual(["Science", "Art"]);
  });
});
