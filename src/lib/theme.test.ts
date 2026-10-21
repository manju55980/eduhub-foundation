import { afterEach, describe, expect, it } from "vitest";

import { applyTheme, readStoredTheme, storeTheme, themeBootScript, themeStorageKey } from "./theme";

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
