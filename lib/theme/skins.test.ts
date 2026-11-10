import { describe, it, expect } from "vitest";
import { DEFAULT_SKIN_TOKEN_KEYS, DEFAULT_SKIN_FONT_FAMILIES } from "@/lib/theme/skins-core";
import { SKIN_TOKEN_KEYS } from "./themes";
import { THEME_WEBFONT_FAMILIES } from "./theme-webfonts";
import { THEMES } from "./themes";
import { validateSkinPayload } from "./skins";
import { themeToSkinPayloadDraft } from "./skin-submit";

// The INTERACTION pin (house rule: "a comment saying MUST match web enforces
// nothing"). apps/internal has no import path to apps/web, so it validates
// against @sontara/core/skins' DEFAULT_SKIN_* mirror. This test is what makes
// that mirror trustworthy — if apps/web's real catalog ever changes without
// updating the core mirror, THIS fails, not just a stale comment.
//
// Compares against SKIN_TOKEN_KEYS (the SKIN schema's token set — the base
// catalog's THEME_TOKEN_KEYS plus the 3 editor-only extras), not
// THEME_TOKEN_KEYS directly: apps/web's actual skin validation config
// (lib/skins.ts SKIN_VALIDATION_CONFIG) has bound SKIN_TOKEN_KEYS since the
// skin editor shipped (2026-08-25), so THIS constant is the real source of
// truth for what a stored skin payload must define.
describe("core skin-schema mirror stays in sync with the real theme catalog", () => {
  it("DEFAULT_SKIN_TOKEN_KEYS matches SKIN_TOKEN_KEYS exactly (as sets)", () => {
    expect(new Set(DEFAULT_SKIN_TOKEN_KEYS)).toEqual(new Set(SKIN_TOKEN_KEYS));
    expect(DEFAULT_SKIN_TOKEN_KEYS.length).toBe(SKIN_TOKEN_KEYS.length);
  });

  it("DEFAULT_SKIN_FONT_FAMILIES matches THEME_WEBFONT_FAMILIES exactly (as sets)", () => {
    expect(new Set(DEFAULT_SKIN_FONT_FAMILIES)).toEqual(new Set(THEME_WEBFONT_FAMILIES));
    expect(DEFAULT_SKIN_FONT_FAMILIES.length).toBe(THEME_WEBFONT_FAMILIES.length);
  });
});

// Round-trip pin: a REAL vendored theme, converted through the SAME draft
// builder the skin editor seeds its starting point from, must validate clean
// against the web shim's LIVE config. Proves validateSkinPayload's fixed
// schema (now SKIN_TOKEN_KEYS + the display font slot) actually accepts what
// the editor's "pick a preset, change nothing, save" path produces — not just
// synthetic fixtures.
describe("validateSkinPayload (web shim) accepts a real catalog theme's tokens", () => {
  it("accepts 'modern-minimal' converted via themeToSkinPayloadDraft", () => {
    const theme = THEMES.find((t) => t.id === "modern-minimal");
    if (!theme) throw new Error("fixture theme missing");
    const draft = themeToSkinPayloadDraft(theme, "My Modern Minimal");
    const result = validateSkinPayload(draft);
    expect(result.ok).toBe(true);
  });

  it("accepts the Sontara 'default' theme (hex colors, brand font vars→system fallback)", () => {
    const theme = THEMES.find((t) => t.id === "default");
    if (!theme) throw new Error("fixture theme missing");
    // "default" uses brand var(--font-*) stacks, not a webfont name — the
    // draft builder maps these to an allowlisted key or a system stack, since
    // the literal var(...) string is (correctly) not a valid font key.
    const draft = themeToSkinPayloadDraft(theme, "My Sontara");
    expect(validateSkinPayload(draft).ok).toBe(true);
  });

  it("rejects the 'default' theme's literal font stack string as a fontKey (not a key, a free string)", () => {
    const theme = THEMES.find((t) => t.id === "default");
    if (!theme) throw new Error("fixture theme missing");
    const draft = themeToSkinPayloadDraft(theme, "My Sontara");
    const payload = {
      ...draft,
      fontKey: { sans: theme.fontSans, serif: theme.fontSerif, mono: theme.fontMono, display: theme.fontSans },
    };
    expect(validateSkinPayload(payload).ok).toBe(false);
  });
});
