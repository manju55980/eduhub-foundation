import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import { applyTheme, readStoredTheme, storeTheme, themeBootScript, themeStorageKey } from "./theme";

const styles = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../styles.css"), "utf8");

afterEach(() => {
  document.documentElement.classList.remove("dark");
  window.localStorage.clear();
});

describe("theme preference", () => {
  it("defaults to light when nothing is stored", () => {
    expect(readStoredTheme()).toBe("light");
  });

  it("reads a stored dark preference and ignores any other value", () => {
    window.localStorage.setItem(themeStorageKey, "dark");
    expect(readStoredTheme()).toBe("dark");

    window.localStorage.setItem(themeStorageKey, "system");
    expect(readStoredTheme()).toBe("light");
  });

  it("stores the choice and sets the dark class on the document", () => {
    storeTheme("dark");
    applyTheme("dark");

    expect(window.localStorage.getItem(themeStorageKey)).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    storeTheme("light");
    applyTheme("light");

    expect(window.localStorage.getItem(themeStorageKey)).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("keeps the current view when storage is blocked", () => {
    const setItem = window.localStorage.setItem.bind(window.localStorage);
    window.localStorage.setItem = () => {
      throw new Error("blocked");
    };

    expect(() => storeTheme("dark")).not.toThrow();
    applyTheme("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    window.localStorage.setItem = setItem;
  });

  it("boots dark mode from the same storage key before paint", () => {
    expect(themeBootScript).toContain(JSON.stringify(themeStorageKey));
    expect(themeBootScript).toContain('classList.add("dark")');
    expect(themeBootScript).not.toContain("light");
  });
});

describe("theme tokens", () => {
  it("keeps the approved light and dark palette in styles.css", () => {
    expect(styles).toContain("--primary: oklch(0.42 0.09 155);");
    expect(styles).toContain("--primary: oklch(0.74 0.11 155);");
    expect(styles).toContain("--primary-hover: oklch(0.48 0.09 155);");
    expect(styles).toContain("--primary-hover: oklch(0.8 0.09 155);");
    expect(styles).toContain("--ring: oklch(0.5 0.14 255);");
    expect(styles).toContain("--ring: oklch(0.74 0.12 255);");
    expect(styles).toContain(
      "--elevation-raised: 0 1px 2px oklch(0 0 0 / 0.35), 0 1px 3px oklch(0 0 0 / 0.35);",
    );
  });

  it("zeros motion when the user prefers reduced motion", () => {
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(styles).toContain("transition-duration: 0ms !important;");
    expect(styles).toContain("animation-duration: 0ms !important;");
  });
});
