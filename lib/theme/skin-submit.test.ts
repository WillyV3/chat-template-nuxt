import { describe, it, expect } from "vitest";
import { themeToSkinPayloadDraft } from "./skin-submit";
import { validateSkinPayload } from "./skins";
import { THEMES, SKIN_EXTRA_DEFAULTS, SKIN_EXTRA_TOKEN_KEYS } from "./themes";

function themeById(id: string) {
  const t = THEMES.find((t) => t.id === id);
  if (!t) throw new Error(`fixture theme ${id} missing`);
  return t;
}

describe("themeToSkinPayloadDraft + validateSkinPayload — every real theme submits clean", () => {
  it("converts 'default' (brand var(--font-*) stacks) to allowlisted/system fontKeys", () => {
    const draft = themeToSkinPayloadDraft(themeById("default"));
    // Geist/Geist Mono ARE on the webfont allowlist; the serif slot falls
    // back to the system "ui-serif" keyword since Literata is only reachable
    // via a var() the picker can't literal-match.
    expect(draft.fontKey.sans).toBe("Geist");
    expect(draft.fontKey.mono).toBe("Geist Mono");
    expect(draft.fontKey.serif).toBe("ui-serif");
    expect(validateSkinPayload(draft).ok).toBe(true);
  });

  it("converts 'modern-minimal' (plain webfont names) by picking the first family", () => {
    const draft = themeToSkinPayloadDraft(themeById("modern-minimal"));
    expect(draft.fontKey.sans).toBe("Inter");
    expect(draft.fontKey.serif).toBe("Source Serif 4");
    expect(draft.fontKey.mono).toBe("JetBrains Mono");
    expect(validateSkinPayload(draft).ok).toBe(true);
  });

  it("EVERY base catalog theme converts to a payload validateSkinPayload accepts", () => {
    const failures: string[] = [];
    for (const theme of THEMES) {
      const draft = themeToSkinPayloadDraft(theme);
      const result = validateSkinPayload(draft);
      if (!result.ok) failures.push(`${theme.id}: ${result.errors.join(", ")}`);
    }
    expect(failures).toEqual([]);
  });

  it("an explicit label override wins and is trimmed", () => {
    const draft = themeToSkinPayloadDraft(themeById("modern-minimal"), "  My Cool Look  ");
    expect(draft.label).toBe("My Cool Look");
  });

  it("falls back to the theme's own label when no override is given", () => {
    const draft = themeToSkinPayloadDraft(themeById("modern-minimal"));
    expect(draft.label).toBe("Modern Minimal");
  });

  it("seeds fontKey.display from the theme's own sans pick (no themed display face on any catalog theme)", () => {
    expect(themeToSkinPayloadDraft(themeById("default")).fontKey.display).toBe("Geist");
    expect(themeToSkinPayloadDraft(themeById("modern-minimal")).fontKey.display).toBe("Inter");
  });

  it("seeds the 3 editor-only extras from SKIN_EXTRA_DEFAULTS for every catalog theme (none define them)", () => {
    for (const theme of THEMES) {
      const draft = themeToSkinPayloadDraft(theme);
      for (const key of SKIN_EXTRA_TOKEN_KEYS) {
        expect(draft.light[key], `${theme.id} light.${key}`).toBe(SKIN_EXTRA_DEFAULTS.light[key]);
        expect(draft.dark[key], `${theme.id} dark.${key}`).toBe(SKIN_EXTRA_DEFAULTS.dark[key]);
      }
    }
  });
});
