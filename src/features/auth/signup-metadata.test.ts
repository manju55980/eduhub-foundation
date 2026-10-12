import { describe, expect, it } from "vitest";

import { signupMetadata } from "./signup-metadata";

describe("signupMetadata", () => {
  it("stores a trimmed name and does not include a role", () => {
    expect(signupMetadata("  Ada Lovelace  ")).toEqual({ full_name: "Ada Lovelace" });
    expect(signupMetadata("Ada")).not.toHaveProperty("role");
  });

  it("omits metadata when the name is blank", () => {
    expect(signupMetadata("   ")).toBeUndefined();
  });
});
