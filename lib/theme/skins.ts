// Thin shim over ./skins-core (Sontara's shape: domain rules live in core, web
// binds the REAL theme catalog's allowlists as the validation config).
// PORTABILITY CUT: the DB data-layer re-exports (createSkin/listSkins/...) are
// gone; persistence is skin-store.ts.
import {
  isSkinSlug,
  generateSkinSlug,
  validateSkinPayload as coreValidateSkinPayload,
  resolveSkinTheme as coreResolveSkinTheme,
  type SkinPayload,
  type SkinRow,
  type SkinStatus,
  type SkinTheme,
  type SkinValidationResult,
} from "./skins-core";
import { SKIN_TOKEN_KEYS } from "./themes";
import { THEME_WEBFONT_FAMILIES } from "./theme-webfonts";

const SKIN_VALIDATION_CONFIG = {
  tokenKeys: SKIN_TOKEN_KEYS,
  fontFamilies: THEME_WEBFONT_FAMILIES,
};

export function validateSkinPayload(payload: unknown): SkinValidationResult {
  return coreValidateSkinPayload(payload, SKIN_VALIDATION_CONFIG);
}

/** Build a Theme-shaped object from a stored skin row, re-validating against
 *  the LIVE catalog. Returns null on anything unexpected — callers fall back
 *  to the default theme, never render a null. */
export function resolveSkinTheme(row: SkinRow): SkinTheme | null {
  return coreResolveSkinTheme(row, SKIN_VALIDATION_CONFIG);
}

export { isSkinSlug, generateSkinSlug };
export type { SkinPayload, SkinRow, SkinStatus, SkinTheme };
