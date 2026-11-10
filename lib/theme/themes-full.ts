// SERVER-ONLY theme resolver over the FULL catalog (base 40 + lazy extra).
//
// WHY SEPARATE FROM themes.ts: themes.ts is the small SHARED catalog the website
// builder and the client bundle import; it must NEVER pull in themes-extra.ts
// (~1000 themes, ~1.9 MB). This module DOES statically import themes-extra, so
// it may only be used from SERVER code — the root layout's FOUC injection
// and any server-side id validation. Importing it from a client
// component would defeat the lazy-load and bloat the client bundle. The picker
// resolves extra themes on the client via a DYNAMIC import instead.
import { THEMES, DEFAULT_THEME_ID, type Theme } from "./themes";
import { themeCss } from "./theme-css";
import { EXTRA_THEMES } from "./themes-extra";

/** The FULL catalog (base 40 + extra) as one array — SERVER ONLY. Used by the
 *  /api/themes search endpoint that the agent's `list_themes` tool calls. */
export const ALL_THEMES: Theme[] = [...THEMES, ...EXTRA_THEMES];

/** Every valid theme id (base + extra) — for server-side membership checks
 *  (e.g. an `onSave` handler validating an id). Catalog ids only; a `skin-*`
 *  id is local to the user's browser (skin-store.ts) and is never in here. */
export const ALL_THEME_IDS: Set<string> = new Set(ALL_THEMES.map((t) => t.id));

/** Resolve a stored id against the full catalog: base first, then extra, else
 *  the default. Never returns undefined — mirrors themeById() but sees the extra
 *  catalog too, so a saved extra theme injects correctly on first paint. */
export function themeByIdFull(id: string | null | undefined): Theme {
  return (
    THEMES.find((t) => t.id === id) ??
    EXTRA_THEMES.find((t) => t.id === id) ??
    THEMES.find((t) => t.id === DEFAULT_THEME_ID)!
  );
}

/** Server render path for the no-flash <style>: theme cookie value -> CSS.
 *  An unknown id, absent cookie, or a `skin-*` id (skins live in the browser,
 *  the server can't see them) all resolve to the default theme; the client
 *  provider re-applies a saved skin on mount. */
export function themeCssFromCookie(value: string | null | undefined): string {
  return themeCss(themeByIdFull(value));
}
