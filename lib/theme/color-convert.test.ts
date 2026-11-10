import { describe, it, expect } from "vitest";
import { isValidColorValue } from "@/lib/theme/skins-core";
import { hexToOklch, oklchToHex, parseHex, rgbToHex, isParseableOklch } from "./color-convert";

describe("hex <-> oklch round-trip", () => {
  const samples = ["#0097b2", "#ffffff", "#000000", "#ef4444", "#282120", "#5a5655"];

  it("hexToOklch produces a string core's color grammar accepts", () => {
    for (const hex of samples) {
      const oklch = hexToOklch(hex);
      expect(oklch).not.toBeNull();
      expect(isValidColorValue(oklch)).toBe(true);
    }
  });

  it("round-trips hex -> oklch -> hex within a couple of ULPs of rounding error", () => {
    for (const hex of samples) {
      const oklch = hexToOklch(hex)!;
      const back = oklchToHex(oklch)!;
      const a = parseHex(hex)!;
      const b = parseHex(back)!;
      expect(Math.abs(a.r - b.r)).toBeLessThanOrEqual(1);
      expect(Math.abs(a.g - b.g)).toBeLessThanOrEqual(1);
      expect(Math.abs(a.b - b.b)).toBeLessThanOrEqual(1);
    }
  });

  it("round-trips a vendored catalog oklch() value -> hex -> oklch to the same color", () => {
    const original = "oklch(0.6231 0.1880 259.8145)";
    const hex = oklchToHex(original)!;
    expect(hex).toMatch(/^#[0-9a-f]{6}$/);
    const back = hexToOklch(hex)!;
    expect(isValidColorValue(back)).toBe(true);
    // re-converting back to hex should land on the same pixel
    expect(oklchToHex(back)).toBe(hex);
  });

  it("parseHex accepts 3-digit shorthand and a leading #", () => {
    expect(parseHex("#abc")).toEqual(parseHex("#aabbcc"));
    expect(parseHex("aabbcc")).toEqual({ r: 170, g: 187, b: 204 });
  });

  it("parseHex rejects garbage", () => {
    expect(parseHex("not-a-color")).toBeNull();
    expect(parseHex("#12345")).toBeNull();
    expect(parseHex("red")).toBeNull();
  });

  it("oklchToHex rejects garbage and a breakout attempt", () => {
    expect(oklchToHex("not-oklch")).toBeNull();
    expect(oklchToHex("oklch(0.5 0.1 200); background:url(evil)")).toBeNull();
  });

  it("oklchToHex rejects out-of-bounds components — never hands the draft a value the security grammar would reject", () => {
    expect(oklchToHex("oklch(5 0.1 200)")).toBeNull(); // L > 1
    expect(oklchToHex("oklch(0.5 10 200)")).toBeNull(); // C > 1
    expect(oklchToHex("oklch(0.5 0.1 999)")).toBeNull(); // H > 360
  });

  it("isParseableOklch distinguishes oklch() strings from hex/keywords", () => {
    expect(isParseableOklch("oklch(0.5 0.1 200)")).toBe(true);
    expect(isParseableOklch("#ffffff")).toBe(false);
    expect(isParseableOklch("transparent")).toBe(false);
  });

  it("rgbToHex clamps and pads", () => {
    expect(rgbToHex({ r: 0, g: 0, b: 0 })).toBe("#000000");
    expect(rgbToHex({ r: 255, g: 255, b: 255 })).toBe("#ffffff");
    expect(rgbToHex({ r: -5, g: 300, b: 15 })).toBe("#00ff0f");
  });
});
