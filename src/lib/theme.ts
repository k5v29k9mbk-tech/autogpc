// Theme = one data-attribute on <html> plus a localStorage key. The initial
// value is applied by an inline script in index.html (before first paint, so
// there's no flash of the wrong theme); this module only flips it afterwards.
// ponytail: no context/provider — nothing re-renders on theme change except the
// menu's own label, and CSS vars do the rest.

export type Theme = "dark" | "light";

export const THEME_KEY = "nexus.theme";

export function getTheme(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

export function setTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Storage may be unavailable (private mode) — the theme still applies for
    // this session, it just won't survive a reload.
  }
}
