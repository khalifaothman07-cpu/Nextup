import { useEffect, useState } from "react";

const KEY = "nextup-theme";

/**
 * Light/dark switch. The site ships dark; §5 also specifies a cream/deep-red
 * light mode, so the palette exists in both and this is what reaches it.
 *
 * Unset means "follow the OS" — the token block's prefers-color-scheme query
 * handles that case, and stamping data-theme only happens once someone makes
 * an explicit choice, so we never override a system preference by default.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState(
    () => localStorage.getItem(KEY) || "system",
  );

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") {
      root.removeAttribute("data-theme");
      localStorage.removeItem(KEY);
    } else {
      root.setAttribute("data-theme", theme);
      localStorage.setItem(KEY, theme);
    }
  }, [theme]);

  const dark =
    theme === "dark" ||
    (theme === "system" &&
      !window.matchMedia("(prefers-color-scheme: light)").matches);

  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setTheme(dark ? "light" : "dark")}
    >
      {dark ? "Light" : "Dark"}
    </button>
  );
}
