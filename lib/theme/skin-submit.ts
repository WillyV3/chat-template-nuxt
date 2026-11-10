// The starting-point seed for the skin editor (and, historically, the
// original "share my current look as-is" flow it replaced): the user always
// begins from a complete, valid Theme (a catalog preset OR their currently-
// applied theme, which may itself be a previously-approved SkinTheme), so
// building the initial draft just repackages it — every subsequent edit
// mutates this SAME shape, so "make no edits, hit save" still submits clean.
//
// Font fields on a Theme are FULL font-family strings ("Inter, sans-serif",
// or a brand var(--font-*) stack for "default") — a skin stores KEYS, so this
// picks the first candidate in that string that's on the webfont allowlist or
// a generic system-stack keyword, falling back to the slot's own generic
// keyword (always valid). That fallback is why even the brand "default"
// theme — whose literal font strings are never on the allowlist — still
// converts to something the server WILL accept, not merely something that
// resembles one.
import { THEME_WEBFONT_FAMILIES } from "./theme-webfonts";
import { SKIN_EXTRA_DEFAULTS, type Theme } from "./themes";

const SYSTEM_FONT_STACK_KEYS = [
  "system-ui", "ui-sans-serif", "ui-serif", "ui-monospace",
  "sans-serif", "serif", "monospace",
];

function pickFontKey(fontFamily: string, fallback: string): string {
  const candidates = fontFamily.split(",").map((s) => s.trim().replace(/^["']|["']$/g, ""));
  for (const c of candidates) if (THEME_WEBFONT_FAMILIES.includes(c)) return c;
  for (const c of candidates) if (SYSTEM_FONT_STACK_KEYS.includes(c)) return c;
  return fallback;
}

export interface SkinPayloadDraft {
  label: string;
  swatch: string[];
  light: Record<string, string>;
  dark: Record<string, string>;
  fontKey: { sans: string; serif: string; mono: string; display: string };
}

/** Build a submittable (and further-editable) skin draft from the theme the
 *  user picked as their starting point. `label` is overridable so the name
 *  field drives what's shown in the gallery.
 *
 *  The 3 editor-only extras (letter-spacing/shadow-color/agent-surface) come
 *  from the preset's OWN light/dark maps when it has them (true when the
 *  preset is itself a previously-resolved custom skin — SkinTheme's light/
 *  dark always carry them) and fall back to SKIN_EXTRA_DEFAULTS otherwise
 *  (true for every base/extra catalog Theme, none of which theme these keys).
 *  `fontKey.display` seeds from the preset's fontDisplay if it has one
 *  (again, a re-edited skin), else from its fontSans — a plain preset has no
 *  themed display face, so "match the body font" is the least-surprising
 *  default the editor can offer before the user picks something else. */
export function themeToSkinPayloadDraft(theme: Theme, label?: string): SkinPayloadDraft {
  return {
    label: label?.trim() || theme.label,
    swatch: theme.swatch,
    light: { ...SKIN_EXTRA_DEFAULTS.light, ...theme.light },
    dark: { ...SKIN_EXTRA_DEFAULTS.dark, ...theme.dark },
    fontKey: {
      sans: pickFontKey(theme.fontSans, "sans-serif"),
      serif: pickFontKey(theme.fontSerif, "serif"),
      mono: pickFontKey(theme.fontMono, "monospace"),
      display: pickFontKey(theme.fontDisplay ?? theme.fontSans, "sans-serif"),
    },
  };
}
