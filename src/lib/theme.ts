export const themeStorageKey = "eduhub-theme";

export type ColorTheme = "light" | "dark";

export function readStoredTheme(): ColorTheme {
  try {
    return window.localStorage.getItem(themeStorageKey) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function applyTheme(theme: ColorTheme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export function storeTheme(theme: ColorTheme) {
  try {
    window.localStorage.setItem(themeStorageKey, theme);
  } catch {
    // The current view still follows the choice when storage is blocked.
  }
}

export const themeBootScript = `(function(){try{if(localStorage.getItem(${JSON.stringify(themeStorageKey)})==="dark"){document.documentElement.classList.add("dark")}}catch(e){}})();`;
