import { describe, expect, it } from "vitest";

import { externalVideoUrl } from "./video-url";

describe("externalVideoUrl", () => {
  it("keeps an absolute http or https URL", () => {
    expect(externalVideoUrl(" https://example.com/lesson ")).toBe("https://example.com/lesson");
    expect(externalVideoUrl("http://example.com/watch")).toBe("http://example.com/watch");
  });

  it("rejects a blank value and a URL that is not http or https", () => {
    expect(externalVideoUrl(null)).toBeNull();
    expect(externalVideoUrl("  ")).toBeNull();
    expect(externalVideoUrl("not a url")).toBeNull();
    expect(externalVideoUrl("javascript:alert(1)")).toBeNull();
    expect(externalVideoUrl("ftp://example.com/video")).toBeNull();
  });
});
