// Adapts a SkinPayloadDraft (the editor's in-progress state) into the
// Theme shape theme-css.ts's themeCssScoped already knows how to render — so
// the preview reuses the EXACT SAME token->CSS mechanism the app applies a
// real theme with, never a parallel renderer. Font resolution here mirrors
// packages/core/src/skins.ts's resolveFontFamily (key + generic fallback,
// system keywords passed through verbatim) — a small, presentation-only
// duplicate: this only feeds the live preview, never the security boundary
// (validateSkinPayload re-derives its own resolution on the server).
import type { Theme } from "@/lib/theme/themes";
import type { SkinPayloadDraft } from "@/lib/theme/skin-submit";

const SYSTEM_FONT_STACK_KEYS = new Set([
  "system-ui", "ui-sans-serif", "ui-serif", "ui-monospace",
  "sans-serif", "serif", "monospace",
]);

function resolvePreviewFont(key: string, fallback: string): string {
  if (SYSTEM_FONT_STACK_KEYS.has(key)) return key;
  return `${key}, ${fallback}`;
}

export function draftToPreviewTheme(draft: SkinPayloadDraft): Theme {
  return {
    id: "skin-editor-preview",
    label: draft.label || "Preview",
    swatch: [],
    light: draft.light,
    dark: draft.dark,
    fontSans: resolvePreviewFont(draft.fontKey.sans, "sans-serif"),
    fontSerif: resolvePreviewFont(draft.fontKey.serif, "serif"),
    fontMono: resolvePreviewFont(draft.fontKey.mono, "monospace"),
    fontDisplay: resolvePreviewFont(draft.fontKey.display, "sans-serif"),
  };
}
