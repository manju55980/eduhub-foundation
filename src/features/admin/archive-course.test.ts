import { describe, expect, it } from "vitest";

import { archivedStatusUpdate } from "./archive-course";

describe("archivedStatusUpdate", () => {
  it("changes only status to archived", () => {
    expect(archivedStatusUpdate()).toEqual({ status: "archived" });
    expect(Object.keys(archivedStatusUpdate())).toEqual(["status"]);
  });
});
