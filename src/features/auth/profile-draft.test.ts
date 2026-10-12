import { describe, expect, it } from "vitest";

import { profileDraft, profileUpdate } from "./profile-draft";

describe("profileDraft", () => {
  it("trims each field and stores a blank as null", () => {
    expect(profileDraft("  Ada Lovelace  ", "  ada@example.com  ", "  555  ")).toEqual({
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      phone: "555",
    });
    expect(profileDraft("   ", "", "  ")).toEqual({
      fullName: null,
      email: null,
      phone: null,
    });
  });
});

describe("profileUpdate", () => {
  it("sends only the three granted columns", () => {
    const changes = profileUpdate({
      fullName: "Ada Lovelace",
      email: null,
      phone: "555",
    });

    expect(changes).toEqual({
      full_name: "Ada Lovelace",
      email: null,
      phone: "555",
    });
    expect(Object.keys(changes)).toEqual(["full_name", "email", "phone"]);
  });
});
