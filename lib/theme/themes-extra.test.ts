import { describe, it, expect } from "vitest";
import {
  THEMES,
  THEME_TOKEN_KEYS,
  FONT_TOKEN_KEYS,
  DEFAULT_THEME_ID,
} from "./themes";
import { EXTRA_THEMES } from "./themes-extra";
import { ALL_THEME_IDS, themeByIdFull } from "./themes-full";
import { THEME_WEBFONT_FAMILIES } from "./theme-webfonts";

// The extra catalog is GENERATED (scripts/generate-extra-themes.mjs). It holds
// only REAL, dual-mode shadcn themes that also change the fonts — the ~748
// auto-converted VSCode themes were dropped (2026-08-12: single-palette + a dead
// light/dark toggle + fontless). These pins enforce the invariants themes.ts
// "default" sets: every theme defines every token key in BOTH modes, light !==
// dark, and every non-system font it names is actually loaded.
const REF = new Set(THEME_TOKEN_KEYS);
const BASE_IDS = new Set(THEMES.map((t) => t.id));

// Order-independent fingerprint of a token map, for the dual-mode compare.
const fingerprint = (m: Record<string, string>) =>
  THEME_TOKEN_KEYS.map((k) => m[k]).join("|");

describe("extra theme catalog", () => {
  it("is a real, curated dual-mode set (regen guard)", () => {
    // 25 at authoring (12 jln neutral bases + 12 shadcn-studio + 1 eight-bit).
    // Guard both ways: against a regen that silently produces far fewer, AND
    // against the dropped VSCode set (~748) ballooning back in.
    expect(EXTRA_THEMES.length).toBeGreaterThanOrEqual(20);
    expect(EXTRA_THEMES.length).toBeLessThanOrEqual(80);
  });

  it("EVERY extra theme defines the full token key set in both light and dark", () => {
    for (const t of EXTRA_THEMES) {
      expect(new Set(Object.keys(t.light)), `${t.id} light`).toEqual(REF);
      expect(new Set(Object.keys(t.dark)), `${t.id} dark`).toEqual(REF);
      for (const k of THEME_TOKEN_KEYS) {
        expect(t.light[k], `${t.id} light ${k}`).toBeTruthy();
        expect(t.dark[k], `${t.id} dark ${k}`).toBeTruthy();
      }
    }
  });

  it("EVERY extra theme is DUAL-MODE (light palette !== dark palette)", () => {
    // The whole reason the VSCode set was dropped: light === dark made the
    // next-themes light/dark toggle a no-op. A single-palette theme must never
    // ship here again.
    const singleMode: string[] = [];
    for (const t of EXTRA_THEMES) {
      if (fingerprint(t.light) === fingerprint(t.dark)) singleMode.push(t.id);
    }
    expect(singleMode, `single-mode themes: ${singleMode.join(", ")}`).toEqual([]);
  });

  it("EVERY extra theme defines a non-empty font for sans, serif and mono", () => {
    for (const t of EXTRA_THEMES) {
      for (const k of FONT_TOKEN_KEYS) {
        expect(t[k], `${t.id} ${k}`).toBeTruthy();
        expect(typeof t[k], `${t.id} ${k} type`).toBe("string");
      }
    }
  });

  // Pin the DATA↔LOADER interaction (mirrors themes.test.ts): every non-system
  // first-family a theme names MUST be loaded by the Google Fonts link, or the
  // font silently falls back. System stacks + the brand var() load elsewhere.
  // This is what makes "the fonts change with the theme" actually true.
  it("every extra font's first family is loaded by theme-webfonts.ts (or is system)", () => {
    const LOADED = new Set(THEME_WEBFONT_FAMILIES.map((f) => f.toLowerCase()));
    const SYSTEM = new Set([
      "sans-serif", "serif", "monospace", "ui-sans-serif", "ui-serif",
      "ui-monospace", "system-ui", "georgia", "menlo", "monaco", "consolas",
      "courier new", "times new roman", "times", "cambria", "arial",
      "helvetica", "helvetica neue", "cursive", "-apple-system",
      "blinkmacsystemfont", "segoe ui", "sfmono-regular", "liberation mono",
      "noto sans", "tahoma", "geneva", "verdana",
    ]);
    const firstFamily = (v: string) =>
      v.split(",")[0].trim().replace(/^['"]|['"]$/g, "").toLowerCase();

    const missing: string[] = [];
    for (const t of EXTRA_THEMES) {
      for (const k of FONT_TOKEN_KEYS) {
        const fam = firstFamily(t[k]);
        if (fam.startsWith("var(") || SYSTEM.has(fam)) continue; // brand/system
        if (!LOADED.has(fam)) missing.push(`${t.id}.${k}=${fam}`);
      }
    }
    expect(missing, `unloaded fonts: ${missing.join(", ")}`).toEqual([]);
  });

  // The WCAG-AA contrast pass runs on every theme at generation. It can only
  // parse hsl() values (the jln bases + eight-bit); the curated oklch studio
  // presets pass through as-is (they already honour shadcn's contract). So this
  // validates that the pass actually held for the themes it applies to: every
  // hsl foreground reads on its hsl background at >= 4.5:1.
  it("hsl foreground/background pairs meet WCAG AA (contrast pass held)", () => {
    const PAIRS: [string, string][] = [
      ["background", "foreground"],
      ["card", "card-foreground"],
      ["popover", "popover-foreground"],
      ["primary", "primary-foreground"],
      ["secondary", "secondary-foreground"],
      ["muted", "muted-foreground"],
      ["accent", "accent-foreground"],
      ["destructive", "destructive-foreground"],
      ["sidebar", "sidebar-foreground"],
      ["sidebar-primary", "sidebar-primary-foreground"],
      ["sidebar-accent", "sidebar-accent-foreground"],
    ];
    const parseHsl = (s: string) => {
      const m = /^hsl\(\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*\)$/.exec(s.trim());
      return m ? { h: +m[1], s: +m[2], l: +m[3] } : null;
    };
    const hslToRgb = ({ h, s, l }: { h: number; s: number; l: number }) => {
      const sn = s / 100, ln = l / 100;
      const c = (1 - Math.abs(2 * ln - 1)) * sn;
      const hp = (((h % 360) + 360) % 360) / 60;
      const x = c * (1 - Math.abs((hp % 2) - 1));
      let r = 0, g = 0, b = 0;
      if (hp < 1) [r, g, b] = [c, x, 0];
      else if (hp < 2) [r, g, b] = [x, c, 0];
      else if (hp < 3) [r, g, b] = [0, c, x];
      else if (hp < 4) [r, g, b] = [0, x, c];
      else if (hp < 5) [r, g, b] = [x, 0, c];
      else [r, g, b] = [c, 0, x];
      const m = ln - c / 2;
      return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
    };
    const relLum = ({ r, g, b }: { r: number; g: number; b: number }) => {
      const lin = (v: number) => {
        const cc = v / 255;
        return cc <= 0.03928 ? cc / 12.92 : ((cc + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    };
    const contrast = (
      a: { h: number; s: number; l: number },
      b: { h: number; s: number; l: number },
    ) => {
      const L1 = relLum(hslToRgb(a)), L2 = relLum(hslToRgb(b));
      const [hi, lo] = L1 >= L2 ? [L1, L2] : [L2, L1];
      return (hi + 0.05) / (lo + 0.05);
    };

    const fails: string[] = [];
    for (const t of EXTRA_THEMES) {
      for (const mode of ["light", "dark"] as const) {
        const map = t[mode];
        for (const [bgKey, fgKey] of PAIRS) {
          const bg = parseHsl(map[bgKey]);
          const fg = parseHsl(map[fgKey]);
          if (!bg || !fg) continue; // oklch/hex — not covered by the pass
          if (contrast(bg, fg) < 4.5) {
            fails.push(`${t.id}.${mode} ${bgKey}/${fgKey}=${contrast(bg, fg).toFixed(2)}`);
          }
        }
      }
    }
    expect(fails, `AA failures: ${fails.join(", ")}`).toEqual([]);
  });

  it("extra ids are unique and disjoint from the base catalog", () => {
    const ids = EXTRA_THEMES.map((t) => t.id);
    expect(new Set(ids).size, "unique within extra").toBe(ids.length);
    for (const id of ids) {
      expect(BASE_IDS.has(id), `${id} collides with a base theme`).toBe(false);
    }
  });

  it("every extra card has a label and 3-4 swatch chips", () => {
    for (const t of EXTRA_THEMES) {
      expect(t.label.length, t.id).toBeGreaterThan(0);
      expect(t.swatch.length, t.id).toBeGreaterThanOrEqual(3);
      expect(t.swatch.length, t.id).toBeLessThanOrEqual(4);
    }
  });

  it("ALL_THEME_IDS covers base + extra with no loss", () => {
    expect(ALL_THEME_IDS.size).toBe(THEMES.length + EXTRA_THEMES.length);
    for (const t of THEMES) expect(ALL_THEME_IDS.has(t.id)).toBe(true);
    for (const t of EXTRA_THEMES) expect(ALL_THEME_IDS.has(t.id)).toBe(true);
  });

  it("themeByIdFull resolves base, extra, and falls back to default", () => {
    expect(themeByIdFull(EXTRA_THEMES[0].id).id).toBe(EXTRA_THEMES[0].id);
    expect(themeByIdFull("eight-bit").id).toBe("eight-bit"); // extra resolves
    expect(themeByIdFull("vercel").id).toBe("vercel"); // base still wins
    expect(themeByIdFull("nope-not-a-theme").id).toBe(DEFAULT_THEME_ID);
    expect(themeByIdFull(null).id).toBe(DEFAULT_THEME_ID);
  });
});
