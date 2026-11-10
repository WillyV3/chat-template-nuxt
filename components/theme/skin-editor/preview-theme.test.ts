import { describe, it, expect } from "vitest";
import { draftToPreviewTheme } from "./preview-theme";
import { themeCssScoped } from "@/lib/theme/theme-css";
import { themeToSkinPayloadDraft } from "@/lib/theme/skin-submit";
import { THEMES } from "@/lib/theme/themes";

function draftFor(id: string) {
  const theme = THEMES.find((t) => t.id === id)!;
  return themeToSkinPayloadDraft(theme, "Preview Draft");
}

describe("draftToPreviewTheme", () => {
  it("carries every light/dark token through unchanged (including the 3 editor-only extras)", () => {
    const draft = draftFor("modern-minimal");
    const theme = draftToPreviewTheme(draft);
    expect(theme.light).toEqual(draft.light);
    expect(theme.dark).toEqual(draft.dark);
    expect(theme.light["shadow-color"]).toBeTruthy();
    expect(theme.light["agent-surface"]).toBeTruthy();
    expect(theme.light["letter-spacing"]).toBeTruthy();
  });

  it("resolves a webfont fontKey to 'Name, generic-fallback'", () => {
    const theme = draftToPreviewTheme(draftFor("modern-minimal"));
    expect(theme.fontSans).toBe("Inter, sans-serif");
    expect(theme.fontMono).toBe("JetBrains Mono, monospace");
  });

  it("passes a system-stack fontKey through verbatim (no fallback appended)", () => {
    const draft = draftFor("default");
    // "default" resolves its serif slot to the system keyword "ui-serif".
    expect(draft.fontKey.serif).toBe("ui-serif");
    const theme = draftToPreviewTheme(draft);
    expect(theme.fontSerif).toBe("ui-serif");
  });

  it("feeds cleanly into themeCssScoped — the SAME CSS mechanism the app uses to apply a real theme", () => {
    const draft = draftFor("violet-bloom");
    const theme = draftToPreviewTheme(draft);
    const css = themeCssScoped(theme, ".skin-preview-abc");
    expect(css).toContain(".skin-preview-abc{");
    expect(css).toContain(".skin-preview-abc.dark{");
    expect(css).toContain(`--primary:${draft.light.primary}`);
    expect(css).toContain(`--font-display:${theme.fontDisplay}`);
    // letter-spacing aliases onto --tracking-normal so the preview actually
    // shows the change (globals.css's body rule reads tracking-normal).
    expect(css).toContain(`--tracking-normal:${draft.light["letter-spacing"]}`);
  });
});
