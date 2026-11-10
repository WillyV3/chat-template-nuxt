// Cookie persistence for the active theme id — the portable replacement for
// Sontara's PATCH /api/user/preferences. The SERVER layout reads this cookie
// (next/headers cookies()) and renders <style id=THEME_STYLE_ID> before first
// paint (same no-flash design); the client provider writes it on a switch.
// Pure + client-safe: no catalog import here.

export const THEME_COOKIE = "theme";
const ONE_YEAR = 60 * 60 * 24 * 365;

/** `document.cookie = serializeThemeCookie(id)` — not HttpOnly on purpose, the
 *  client writes it. Ids are catalog slugs; encodeURIComponent guards anyway. */
export function serializeThemeCookie(themeId: string): string {
  return `${THEME_COOKIE}=${encodeURIComponent(themeId)}; Path=/; Max-Age=${ONE_YEAR}; SameSite=Lax`;
}

/** Parse the theme id out of a Cookie header / document.cookie string. */
export function readThemeCookie(cookieString: string): string | null {
  for (const part of cookieString.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === THEME_COOKIE) {
      try {
        return decodeURIComponent(v.join("=")) || null;
      } catch {
        return null;
      }
    }
  }
  return null;
}
