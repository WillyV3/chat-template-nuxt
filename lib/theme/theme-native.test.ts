import { describe, expect, it } from "vitest";
import { cssColorToHex, hexToHslTriplet, toNativeTokens, toNativeVars } from "./theme-native";
import { THEMES, THEME_TOKEN_KEYS, themeById, type Theme } from "./themes";
import { EXTRA_THEMES } from "./themes-extra";

const ch = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const near = (h: string, want: string) =>
  ch(h).forEach((c, i) => expect(Math.abs(c - ch(want)[i])).toBeLessThanOrEqual(1));

describe("cssColorToHex", () => {
  it("exact pins", () => {
    expect(cssColorToHex("#FFF")).toBe("#ffffff");
    expect(cssColorToHex("#11223344")).toBe("#112233");
    expect(cssColorToHex("hsl(0 0% 100%)")).toBe("#ffffff");
    expect(cssColorToHex("hsl(120 100% 25%)")).toBe("#008000");
    expect(cssColorToHex("hsl(0, 0%, 0%)")).toBe("#000000");
    expect(cssColorToHex("rgb(255 0 0)")).toBe("#ff0000");
    expect(cssColorToHex("oklch(1 0 0)")).toBe("#ffffff");
    expect(cssColorToHex("oklch(0 0 0)")).toBe("#000000");
  });
  it("oklch red", () => {
    near(cssColorToHex("oklch(0.6279 0.2577 29.23)"), "#ff0000");
    near(cssColorToHex("oklch(62.79% 0.2577 29.23)"), "#ff0000");
  });
  it("oklch alpha / none hue", () => {
    expect(cssColorToHex("oklch(0.5 0.2 240 / 0.5)")).toMatch(/^#[0-9a-f]{6}$/);
    expect(cssColorToHex("oklch(0.5 0 none)")).toMatch(/^#[0-9a-f]{6}$/);
  });
  it("throws on unknown syntax", () => {
    expect(() => cssColorToHex("blue")).toThrow();
  });
  // Samples core's skin validator ACCEPTS (packages/core/src/skins.ts validColorFunction,
  // RADIUS_RE) — an approved community skin can carry any of these, so the converter must too.
  it("accepts every form the skin validator accepts", () => {
    expect(cssColorToHex("rgba(1, 2, 3, 0.5)")).toBe("#010203");
    expect(cssColorToHex("hsla(120, 100%, 25%, 0.4)")).toBe("#008000");
    expect(cssColorToHex("rgb(255 0 0 0.5)")).toBe("#ff0000");
    expect(cssColorToHex("hsl(120deg 100% 25%)")).toBe("#008000");
    expect(cssColorToHex("oklch(62.79% 0.2577 29.23deg / 50%)")).toMatch(/^#[0-9a-f]{6}$/);
    expect(cssColorToHex("#ABCDEF80")).toBe("#abcdef");
    const base = themeById("default");
    const em: Theme = { ...base, light: { ...base.light, radius: "0.75em" } };
    expect(toNativeTokens(em, "light").radius).toBe(12);
    expect(toNativeTokens({ ...base, light: { ...base.light, radius: "0" } }, "light").radius).toBe(0);
  });
  // The validator's keywords stay unrepresentable on purpose; the phone guards before applying.
  it("keywords throw (no honest hex) — phone-side guard relies on this", () => {
    for (const k of ["transparent", "currentcolor", "inherit"]) expect(() => cssColorToHex(k)).toThrow();
  });
});

describe("toNativeTokens", () => {
  it("default theme pins", () => {
    expect(toNativeTokens(themeById("default"), "light").primary).toBe("#171717");
    const d = toNativeTokens(themeById("default"), "dark");
    expect(d.background).toBe("#0a0a0a");
    expect(d.radius).toBe(8);
  });
  it("whole catalog converts", () => {
    const all = [...THEMES, ...EXTRA_THEMES];
    expect(all.length).toBeGreaterThan(40);
    for (const t of all) {
      for (const s of ["light", "dark"] as const) {
        const n = toNativeTokens(t, s) as unknown as Record<string, string | number>;
        for (const k of THEME_TOKEN_KEYS) {
          if (k === "radius") continue;
          const key = k.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());
          expect(n[key], `${t.id}/${s}/${k}`).toMatch(/^#[0-9a-f]{6}$/);
        }
        expect(Number.isFinite(n.radius)).toBe(true);
        expect(n.radius as number).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe("toNativeVars", () => {
  it("hsl triplets in the form tailwind.config's hsl(var(--x)) expects", () => {
    expect(hexToHslTriplet("#ffffff")).toBe("0 0% 100%");
    expect(hexToHslTriplet("#000000")).toBe("0 0% 0%");
    expect(hexToHslTriplet("#008000")).toBe("120 100% 25%");
    const v = toNativeVars(themeById("default"), "light");
    expect(v["--primary"]).toBe("0 0% 9%"); // neutral default primary
    expect(v["--radius"]).toBe(8); // a number: NativeWind calc() needs numeric operands
    expect(Object.keys(v)).toHaveLength(THEME_TOKEN_KEYS.length);
  });
});
