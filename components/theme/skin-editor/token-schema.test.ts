import { describe, it, expect } from "vitest";
import {
  COLOR_TOKEN_GROUPS,
  ALL_GROUPED_COLOR_KEYS,
  NON_COLOR_TOKEN_KEYS,
  TOKEN_LABELS,
  FONT_SLOT_LABELS,
  SKIN_TOKEN_KEYS,
  SKIN_FONT_SLOTS,
} from "./token-schema";

// The coverage proof: every token the SECURITY layer knows about
// (SKIN_TOKEN_KEYS — the same constant apps/web/lib/skins.ts binds as the
// validator's config, itself THEME_TOKEN_KEYS + the 3 editor-only extras) is
// rendered SOMEWHERE in the editor — either as a color row or as one of the
// 2 non-color controls (radius slider, letter-spacing slider). Nothing can be
// silently un-editable.
describe("skin editor token coverage", () => {
  it("every color-grammar token in SKIN_TOKEN_KEYS appears in exactly one group", () => {
    const expected = new Set(SKIN_TOKEN_KEYS.filter((k) => !NON_COLOR_TOKEN_KEYS.includes(k as never)));
    expect(new Set(ALL_GROUPED_COLOR_KEYS)).toEqual(expected);
    expect(ALL_GROUPED_COLOR_KEYS.length).toBe(expected.size); // no duplicates across groups
  });

  it("SKIN_TOKEN_KEYS = grouped color keys + the 2 non-color keys, no leftovers", () => {
    const union = new Set([...ALL_GROUPED_COLOR_KEYS, ...NON_COLOR_TOKEN_KEYS]);
    expect(union).toEqual(new Set(SKIN_TOKEN_KEYS));
  });

  it("has exactly 34 color-grammar tokens (32 from the base catalog + shadow-color + agent-surface)", () => {
    expect(ALL_GROUPED_COLOR_KEYS.length).toBe(34);
  });

  it("every grouped key has a human label (or falls back to a readable title-case)", () => {
    for (const key of ALL_GROUPED_COLOR_KEYS) {
      expect(TOKEN_LABELS[key], key).toBeTruthy();
    }
  });

  it("every group has a non-empty id, label and at least one key", () => {
    for (const g of COLOR_TOKEN_GROUPS) {
      expect(g.id.length).toBeGreaterThan(0);
      expect(g.label.length).toBeGreaterThan(0);
      expect(g.keys.length).toBeGreaterThan(0);
    }
  });

  it("every skin font slot (sans/serif/mono/display) has a label", () => {
    for (const slot of SKIN_FONT_SLOTS) {
      expect(FONT_SLOT_LABELS[slot]).toBeTruthy();
    }
  });
});
