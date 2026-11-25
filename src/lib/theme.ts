export type ThemePreference = "system" | "dark" | "light";

export const THEME_PREFERENCES: readonly ThemePreference[] = ["system", "dark", "light"];

export const isThemePreference = (v: unknown): v is ThemePreference =>
  typeof v === "string" && (THEME_PREFERENCES as readonly string[]).includes(v);

/** Applies the preference to <html data-theme>. "system" removes the attribute. */
export function applyTheme(preference: ThemePreference): void {
  if (typeof document === "undefined") return;
  if (preference === "system") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", preference);
}

/**
 * Inline script run before first paint so a saved theme never flashes.
 * Kept as a string because it must execute before React hydrates.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var t=localStorage.getItem("bookgrab.theme");if(t==="dark"||t==="light"){document.documentElement.setAttribute("data-theme",t);}}catch(e){}})();`;
