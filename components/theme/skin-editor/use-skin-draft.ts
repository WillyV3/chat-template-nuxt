// The skin editor's edit state. A thin wrapper around SkinPayloadDraft
// (lib/theme/skin-submit.ts) — the SAME shape the store consumes — so "make no
// edits, hit save" and "tweak everything, hit save" go through one code path
// with no parallel draft representation. `radius` and `letter-spacing` are
// mode-independent BY CONVENTION (every vendored theme sets the same value in
// light and dark — see themes.ts; theme-css.ts's fontVars carries the same
// principle for fonts), so their setters write both maps at once; every other
// token is genuinely per-mode.
import { computed, ref } from "vue";
import type { Theme } from "@/lib/theme/themes";
import { themeToSkinPayloadDraft, type SkinPayloadDraft } from "@/lib/theme/skin-submit";
import { SKIN_FONT_SLOTS } from "@/lib/theme/themes";

/** radius/letter-spacing are mode-independent by convention (see file header)
 *  — their setters write both light and dark at once via setSharedKey. */
type ModeIndependentKey = "radius" | "letter-spacing";

/** The catalog's own swatch convention, reverse-engineered from the vendored
 *  themes (verified against modern-minimal/violet-bloom/etc.: swatch =
 *  [primary, accent, secondary, foreground] from the LIGHT map) — so a
 *  user-authored skin's gallery chip looks exactly like a catalog one. */
export function deriveSwatch(light: Record<string, string>): string[] {
  return [light.primary, light.accent, light.secondary, light.foreground].filter(
    (v): v is string => typeof v === "string" && v.length > 0,
  );
}

export type SkinDraftMode = "light" | "dark";

export function useSkinDraft(initialPreset: Theme, initialLabel?: string) {
  const draft = ref<SkinPayloadDraft>(themeToSkinPayloadDraft(initialPreset, initialLabel));

  const setLabel = (label: string) => {
    draft.value = { ...draft.value, label };
  };

  const setColor = (mode: SkinDraftMode, key: string, value: string) => {
    const d = draft.value;
    draft.value = { ...d, [mode]: { ...d[mode], [key]: value } };
  };

  const setSharedKey = (key: ModeIndependentKey, value: string) => {
    const d = draft.value;
    draft.value = { ...d, light: { ...d.light, [key]: value }, dark: { ...d.dark, [key]: value } };
  };

  const setRadius = (value: string) => setSharedKey("radius", value);
  const setLetterSpacing = (value: string) => setSharedKey("letter-spacing", value);

  const setFont = (slot: (typeof SKIN_FONT_SLOTS)[number], value: string) => {
    const d = draft.value;
    draft.value = { ...d, fontKey: { ...d.fontKey, [slot]: value } };
  };

  const resetFromPreset = (theme: Theme) => {
    draft.value = themeToSkinPayloadDraft(theme, draft.value.label);
  };

  const swatch = computed(() => deriveSwatch(draft.value.light));

  return { draft, swatch, setLabel, setColor, setRadius, setLetterSpacing, setFont, resetFromPreset };
}

export type UseSkinDraft = ReturnType<typeof useSkinDraft>;
