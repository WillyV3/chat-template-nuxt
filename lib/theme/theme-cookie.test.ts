import { describe, it, expect } from "vitest";
import { THEME_COOKIE, serializeThemeCookie, readThemeCookie } from "./theme-cookie";
import { themeCssFromCookie } from "./themes-full";
import { themeCss, THEME_STYLE_ID } from "./theme-css";
import { themeById, DEFAULT_THEME_ID } from "./themes";
import { EXTRA_THEMES } from "./themes-extra";

// The no-flash path: cookie value (read by the server layout) -> theme -> css
// string that goes into <style id=THEME_STYLE_ID> before first paint.
describe("theme cookie", () => {
  it("round-trips an id through the serialized cookie", () => {
    const set = serializeThemeCookie("modern-minimal");
    expect(set.startsWith(`${THEME_COOKIE}=modern-minimal;`)).toBe(true);
    expect(set).toContain("Path=/");
    expect(readThemeCookie(`a=1; ${set.split(";")[0]}; b=2`)).toBe("modern-minimal");
  });

  it("returns null when absent, empty or malformed", () => {
    expect(readThemeCookie("")).toBeNull();
    expect(readThemeCookie("other=x")).toBeNull();
    expect(readThemeCookie("theme=")).toBeNull();
    expect(readThemeCookie("theme=%E0%A4%A")).toBeNull();
  });

  it("cookie value -> css for a base theme", () => {
    expect(themeCssFromCookie("modern-minimal")).toBe(themeCss(themeById("modern-minimal")));
  });

  it("cookie value -> css for a lazy EXTRA theme (server sees the full catalog)", () => {
    const css = themeCssFromCookie(EXTRA_THEMES[0].id);
    expect(css).toContain(":root{");
    expect(css).not.toBe(themeCss(themeById(DEFAULT_THEME_ID)));
  });

  it("absent / unknown / skin-* cookie falls back to the neutral default", () => {
    const def = themeCss(themeById(DEFAULT_THEME_ID));
    expect(themeCssFromCookie(undefined)).toBe(def);
    expect(themeCssFromCookie("nope")).toBe(def);
    expect(themeCssFromCookie("skin-mine-abc123")).toBe(def);
  });

  it("default is neutral, not a brand colour, and the style id is brand-free", () => {
    expect(themeById(DEFAULT_THEME_ID).label).toBe("Neutral");
    expect(THEME_STYLE_ID).toBe("theme-vars");
  });
});
