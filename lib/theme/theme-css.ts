// Turn a vendored Theme into the CSS that re-skins the dashboard. Pure and
// framework-agnostic (a string) so it can run on the server for the FOUC-safe
// first paint AND in the browser for a live switch — and so the website builder
// can reuse it. Imports the DATA module (themes.ts); nothing imports back.
import type { Theme } from "./themes";

/** The id of the single <style> element that holds the active theme's vars.
 *  The server renders it (no flash); the client rewrites its text on switch. */
export const THEME_STYLE_ID = "theme-vars";

/** Exported so the skin editor's live-preview panel (skin-editor-preview.tsx)
 *  can reuse the SAME CSS-generation primitive with a scoped selector instead
 *  of :root/.dark — see themeCssScoped below. Never invent a parallel
 *  renderer; parameterize this one. */
export function block(selector: string, vars: Record<string, string>): string {
  const body = Object.entries(vars)
    .map(([k, v]) => `--${k}:${v}`)
    .join(";");
  return `${selector}{${body}}`;
}

/** letter-spacing (an editor-only skin token, apps/web/lib/themes.ts
 *  SKIN_EXTRA_TOKEN_KEYS) is stored under that name, but globals.css's body
 *  rule actually reads `--tracking-normal` (its Tailwind `tracking-*` utility
 *  derivations — tighter/tight/wide/wider/widest — all key off it too). Alias
 *  the value onto BOTH vars so a skin that sets letter-spacing is actually
 *  visible, not just present-but-inert. A no-op for the ~1040 catalog themes,
 *  none of which define this key. */
function withTrackingAlias(vars: Record<string, string>): Record<string, string> {
  const spacing = vars["letter-spacing"];
  if (spacing === undefined) return vars;
  return { ...vars, "tracking-normal": spacing };
}

/** The theme's font families as `--font-*` vars. Fonts are mode-independent,
 *  so the SAME values go into both the light and dark blocks. Tailwind's
 *  font-sans/serif/mono utilities (and the dashboard root) read these vars, so
 *  a theme swap re-skins the type alongside the colours. The families are
 *  loaded by the Google Fonts link in lib/theme-webfonts.ts. `font-display`
 *  is only emitted when the theme defines one (SkinTheme from a user skin) —
 *  every vendored catalog theme leaves it brand-locked in globals.css. */
function fontVars(theme: Theme): Record<string, string> {
  const vars: Record<string, string> = {
    "font-sans": theme.fontSans,
    "font-serif": theme.fontSerif,
    "font-mono": theme.fontMono,
  };
  if (theme.fontDisplay) vars["font-display"] = theme.fontDisplay;
  return vars;
}

/**
 * CSS that overrides the shadcn semantic tokens for the chosen theme.
 *
 * Emits BOTH modes — `:root` (light) and `.dark` — so it composes with
 * next-themes: next-themes toggles the `.dark` class on <html>, and because
 * these rules come AFTER globals.css in source order (same specificity) they
 * win, so the toggle flips light/dark WITHIN the chosen theme. Values are the
 * vendored catalog's (never user input), so inlining this is safe. Font vars
 * are appended to each block (same value in both — type is mode-independent).
 */
export function themeCss(theme: Theme): string {
  const fonts = fontVars(theme);
  const light = withTrackingAlias({ ...theme.light, ...fonts });
  const dark = withTrackingAlias({ ...theme.dark, ...fonts });
  return `${block(":root", light)}\n${block(".dark", dark)}`;
}

/**
 * Same generation as themeCss, scoped to an arbitrary selector instead of
 * :root/.dark — the skin editor's live-preview panel uses this so an
 * in-progress, unsaved edit repaints ONLY the preview box, never the real
 * dashboard chrome around it. `${selector}` gets the light block,
 * `${selector}.dark` the dark one (the preview toggles its own `dark` class,
 * independent of the app's actual next-themes mode). Same token→CSS
 * mechanism as themeCss — no parallel renderer.
 */
export function themeCssScoped(theme: Theme, selector: string): string {
  const fonts = fontVars(theme);
  const light = withTrackingAlias({ ...theme.light, ...fonts });
  const dark = withTrackingAlias({ ...theme.dark, ...fonts });
  return `${block(selector, light)}\n${block(`${selector}.dark`, dark)}`;
}
