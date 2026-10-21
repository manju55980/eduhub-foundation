import { describe, expect, it } from "vitest";

import { matchesQuery } from "@/components/app-shell/management";

describe("matchesQuery", () => {
  it("keeps every record until a search is entered", () => {
    expect(matchesQuery("  ", ["Algebra", null])).toBe(true);
    expect(matchesQuery("grace", ["Algebra", "Grace Hopper"])).toBe(true);
    expect(matchesQuery("physics", ["Algebra", "Grace Hopper"])).toBe(false);
  });
});
