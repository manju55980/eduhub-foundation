import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { applyTheme, readStoredTheme, storeTheme, themeStorageKey, type ColorTheme } from "@/lib/theme";

export function ThemeToggle() {
  const [theme, setTheme] = useState<ColorTheme>("light");

  useEffect(() => {
    const stored = readStoredTheme();
    setTheme(stored);
    applyTheme(stored);

    function onStorage(event: StorageEvent) {
      if (event.key !== themeStorageKey) return;
      const next: ColorTheme = event.newValue === "dark" ? "dark" : "light";
      setTheme(next);
      applyTheme(next);
    }

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  function toggle() {
    const next: ColorTheme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    storeTheme(next);
    applyTheme(next);
  }

  const dark = theme === "dark";

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="shrink-0 rounded-sm shadow-none"
      aria-pressed={dark}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={toggle}
    >
      {dark ? <Sun /> : <Moon />}
    </Button>
  );
}
