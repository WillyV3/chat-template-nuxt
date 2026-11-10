import { describe, it, expect } from "vitest";
import { THEMES, THEME_TOKEN_KEYS, FONT_TOKEN_KEYS, DEFAULT_THEME_ID, themeById } from "./themes";
import { THEME_WEBFONT_FAMILIES } from "./theme-webfonts";

// The one invariant that keeps a theme swap from breaking the UI: every theme
// must define EVERY token key. A missing var(--x) falls through to whatever the
// previous theme left on :root — a broken, half-swapped skin. "default" is the
// reference set; the whole catalog is pinned to it.
const REF = new Set(THEME_TOKEN_KEYS);

describe("theme catalog", () => {
  it("has the vendored themes plus default (40)", () => {
    expect(THEMES.length).toBe(40);
    expect(THEMES.some((t) => t.id === DEFAULT_THEME_ID)).toBe(true);
  });

  it("default carries exactly the reference token key set", () => {
    const def = themeById(DEFAULT_THEME_ID);
    expect(new Set(Object.keys(def.light))).toEqual(REF);
    expect(new Set(Object.keys(def.dark))).toEqual(REF);
  });

  it("EVERY theme defines the full token key set in both light and dark", () => {
    for (const t of THEMES) {
      expect(new Set(Object.keys(t.light)), `${t.id} light`).toEqual(REF);
      expect(new Set(Object.keys(t.dark)), `${t.id} dark`).toEqual(REF);
      // No empty values — an empty string resolves to nothing.
      for (const k of THEME_TOKEN_KEYS) {
        expect(t.light[k], `${t.id} light ${k}`).toBeTruthy();
        expect(t.dark[k], `${t.id} dark ${k}`).toBeTruthy();
      }
    }
  });

  it("EVERY theme defines a non-empty font for sans, serif and mono", () => {
    for (const t of THEMES) {
      for (const k of FONT_TOKEN_KEYS) {
        expect(t[k], `${t.id} ${k}`).toBeTruthy();
        expect(typeof t[k], `${t.id} ${k} type`).toBe("string");
      }
    }
  });

  it("default keeps the brand font stacks untouched", () => {
    const def = themeById(DEFAULT_THEME_ID);
    expect(def.fontSans).toBe(
      "var(--font-geist-sans), Geist, ui-sans-serif, system-ui, sans-serif",
    );
    expect(def.fontSerif).toBe("var(--font-literata), ui-serif, Georgia, serif");
    expect(def.fontMono).toBe(
      'var(--font-geist-mono), "Geist Mono", ui-monospace, monospace',
    );
  });

  // Pin the interaction between the DATA (themes.ts, tweakcn's literal font
  // strings) and the LOADER (theme-webfonts.ts). Every non-system first-family a
  // theme names MUST be loaded by the Google Fonts link — otherwise the font
  // just doesn't render (a silent fallback). System stacks + the brand var()
  // (default) load elsewhere, so they're skipped. First-family only: fallbacks
  // in the stack are, by definition, system fonts.
  it("every themed font's first family is loaded by theme-webfonts.ts (or is system)", () => {
    const LOADED = new Set(THEME_WEBFONT_FAMILIES.map((f) => f.toLowerCase()));
    const SYSTEM = new Set([
      "sans-serif", "serif", "monospace", "ui-sans-serif", "ui-serif",
      "ui-monospace", "system-ui", "georgia", "menlo", "monaco", "consolas",
      "courier new", "times new roman", "times", "cambria", "arial",
      "helvetica", "helvetica neue", "cursive", "-apple-system",
      "blinkmacsystemfont", "segoe ui", "sfmono-regular", "liberation mono",
      "noto sans",
    ]);
    const firstFamily = (v: string) =>
      v.split(",")[0].trim().replace(/^['"]|['"]$/g, "").toLowerCase();

    const missing: string[] = [];
    for (const t of THEMES) {
      for (const k of FONT_TOKEN_KEYS) {
        const fam = firstFamily(t[k]);
        if (fam.startsWith("var(") || SYSTEM.has(fam)) continue; // brand/system
        if (!LOADED.has(fam)) missing.push(`${t.id}.${k}=${fam}`);
      }
    }
    expect(missing, `unloaded fonts: ${missing.join(", ")}`).toEqual([]);
  });

  it("ids are unique", () => {
    const ids = THEMES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every card has a label and 3-4 swatch chips", () => {
    for (const t of THEMES) {
      expect(t.label.length).toBeGreaterThan(0);
      expect(t.swatch.length).toBeGreaterThanOrEqual(3);
      expect(t.swatch.length).toBeLessThanOrEqual(4);
    }
  });

  it("themeById falls back to default for an unknown/empty id", () => {
    expect(themeById("nope-not-a-theme").id).toBe(DEFAULT_THEME_ID);
    expect(themeById(null).id).toBe(DEFAULT_THEME_ID);
    expect(themeById(undefined).id).toBe(DEFAULT_THEME_ID);
    expect(themeById("vercel").id).toBe("vercel");
  });
});
