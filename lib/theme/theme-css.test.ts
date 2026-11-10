import { describe, it, expect } from "vitest";
import { themeCss, THEME_STYLE_ID } from "./theme-css";
import { themeById } from "./themes";

describe("themeCss", () => {
  const css = themeCss(themeById("default"));

  it("emits a :root (light) and a .dark block", () => {
    expect(css).toContain(":root{");
    expect(css).toContain(".dark{");
    // .dark comes AFTER :root so it wins under next-themes' toggle.
    expect(css.indexOf(".dark{")).toBeGreaterThan(css.indexOf(":root{"));
  });

  it("writes each token as a --var and uses the mode-correct value", () => {
    const def = themeById("default");
    expect(css).toContain(`--primary:${def.light.primary}`);
    // the dark block carries the dark value
    const darkPart = css.slice(css.indexOf(".dark{"));
    expect(darkPart).toContain(`--primary:${def.dark.primary}`);
    expect(css).toContain(`--radius:${def.light.radius}`);
  });

  it("emits the theme's font vars in BOTH blocks (type is mode-independent)", () => {
    const def = themeById("default");
    const rootPart = css.slice(css.indexOf(":root{"), css.indexOf(".dark{"));
    const darkPart = css.slice(css.indexOf(".dark{"));
    for (const part of [rootPart, darkPart]) {
      expect(part).toContain(`--font-sans:${def.fontSans}`);
      expect(part).toContain(`--font-serif:${def.fontSerif}`);
      expect(part).toContain(`--font-mono:${def.fontMono}`);
    }
  });

  it("a non-default theme emits a DIFFERENT font-sans", () => {
    // quantum-rose swaps in Poppins — proves fonts actually change per theme.
    const qr = themeById("quantum-rose");
    const qrCss = themeCss(qr);
    expect(qr.fontSans).not.toBe(themeById("default").fontSans);
    expect(qrCss).toContain(`--font-sans:${qr.fontSans}`);
  });

  it("exposes the shared style element id", () => {
    expect(THEME_STYLE_ID).toBe("theme-vars");
  });
});
