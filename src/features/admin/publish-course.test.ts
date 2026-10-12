import { describe, expect, it } from "vitest";

import { publishedStatusUpdate } from "./publish-course";

describe("publishedStatusUpdate", () => {
  it("changes only status to published", () => {
    expect(publishedStatusUpdate()).toEqual({ status: "published" });
    expect(Object.keys(publishedStatusUpdate())).toEqual(["status"]);
  });
});
