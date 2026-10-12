import { describe, expect, it } from "vitest";

import { canPromote } from "./users";

const actorId = "admin-1";

describe("canPromote", () => {
  it("allows another student", () => {
    expect(canPromote(actorId, { id: "student-1", role: "student" })).toBe(true);
  });

  it("rejects the signed-in admin promoting themselves", () => {
    expect(canPromote(actorId, { id: actorId, role: "student" })).toBe(false);
  });

  it("rejects an instructor, an admin, and a repeated promotion", () => {
    expect(canPromote(actorId, { id: "user-2", role: "instructor" })).toBe(false);
    expect(canPromote(actorId, { id: "user-3", role: "admin" })).toBe(false);
    expect(canPromote(actorId, { id: "student-1", role: "instructor" })).toBe(false);
  });
});
