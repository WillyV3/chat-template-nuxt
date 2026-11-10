// User-submitted skins — the domain object AND its security boundary.
//
// See docs/archive/2026-08-24-user-skins-design.md §4 for the full threat
// model. One-line shape: a skin is a Theme (apps/web/lib/themes.ts) minus
// trust — the SAME fixed token map the appearance switcher already uses
// (colors + font KEYS, no free CSS, no raw selector, no property name ever
// supplied by a user). validateSkinPayload() is the whole security boundary:
// it runs on WRITE (submit) and again on READ (resolver), because a stored
// payload is never assumed still valid — see resolveSkinTheme.
//
// CONFIG INJECTION (house rule: knobs injected into core, never mirrored
// blind): the fixed token-key set and the font allowlist are apps/web's
// catalog (core themes.ts SKIN_TOKEN_KEYS — THEME_TOKEN_KEYS plus the
// editor-only extras letter-spacing/shadow-color/agent-surface — and
// lib/theme-webfonts.ts THEME_WEBFONT_FAMILIES) — apps/web ALWAYS passes its
// own live constants (see apps/web/lib/skins.ts). DEFAULT_SKIN_TOKEN_KEYS /
// DEFAULT_SKIN_FONT_FAMILIES below are a TESTED mirror for apps/internal, a
// separate deployment with no import path to apps/web — pinned against the
// real source by apps/web/lib/skins.test.ts so drift fails a test, not just a
// stale comment.
//
// EDITOR (2026-08-25, the skin CREATOR): the payload now carries a 4th font
// slot (`display`, for --font-display) and 3 extra light/dark tokens
// (letter-spacing, shadow-color, agent-surface) beyond the 33 the base theme
// catalog defines — see apps/web/lib/themes.ts SKIN_TOKEN_KEYS header for why
// these live OUTSIDE the catalog's own THEME_TOKEN_KEYS/FONT_TOKEN_KEYS
// (which stay untouched to avoid forcing ~1040 vendored themes to grow new
// required fields). Same security posture throughout: exact key membership,
// same grammar layers, fail closed on read.
import { SKIN_TOKEN_KEYS } from "./themes";

// ── Payload shape ───────────────────────────────────────────────────────

export interface SkinFontKeys {
  sans: string;
  serif: string;
  mono: string;
  /** `--font-display` — the heading/display face. Required (same "exactly
   *  these slots" posture as sans/serif/mono); the editor always seeds it
   *  (defaults to the sans pick) so no submission path can omit it. */
  display: string;
}

/** The validated, storable shape — deliberately identical to Theme (minus
 *  `id`, which is the DB slug) so the existing render path (themeCss) and
 *  the picker's Theme type consume it unchanged. NEVER a raw-CSS field. */
export interface SkinPayload {
  label: string;
  swatch: string[];
  light: Record<string, string>;
  dark: Record<string, string>;
  fontKey: SkinFontKeys;
}

export interface SkinValidationConfig {
  /** The fixed shadcn token keys a skin must define — exactly these, no
   *  more, no less, in both `light` and `dark`. */
  tokenKeys: readonly string[];
  /** The Google-Fonts allowlist a fontKey value may name. */
  fontFamilies: readonly string[];
}

export type SkinValidationResult =
  | { ok: true; data: SkinPayload }
  | { ok: false; errors: string[] };

// ── Mirrored default config (apps/internal only — see header) ──────────
// Single source: packages/core/src/themes.ts SKIN_TOKEN_KEYS (the catalog's
// THEME_TOKEN_KEYS plus the editor-only extras). Pinned by
// apps/web/lib/skins.test.ts.
export const DEFAULT_SKIN_TOKEN_KEYS = SKIN_TOKEN_KEYS;

// MUST match apps/web/lib/theme-webfonts.ts THEME_WEBFONT_FAMILIES. Pinned by
// apps/web/lib/skins.test.ts.
export const DEFAULT_SKIN_FONT_FAMILIES = [
  "Architects Daughter", "DM Sans", "Fira Code", "Geist", "Geist Mono",
  "IBM Plex Mono", "Inter", "JetBrains Mono", "Libre Baskerville", "Lora",
  "Merriweather", "Montserrat", "Open Sans", "Outfit", "Oxanium",
  "Playfair Display", "Plus Jakarta Sans", "Poppins", "Quicksand", "Roboto",
  "Roboto Mono", "Source Code Pro", "Source Serif 4", "Space Mono", "Ubuntu Mono",
  "Barlow", "Delius Swash Caps", "Gabriela", "Lato", "Nunito", "PT Serif",
  "Pixelify Sans", "Press Start 2P", "VT323",
  "Literata", "Space Grotesk",
] as const;

export const DEFAULT_SKIN_VALIDATION_CONFIG: SkinValidationConfig = {
  tokenKeys: DEFAULT_SKIN_TOKEN_KEYS,
  fontFamilies: DEFAULT_SKIN_FONT_FAMILIES,
};

// A skin can ALSO name one of these generic CSS keywords instead of a Google
// Font — inherently safe (browser-native keyword, not a network request, not
// a string that can break out of anything) and gives users an option that
// costs nothing to serve.
const SYSTEM_FONT_STACK_KEYS = [
  "system-ui", "ui-sans-serif", "ui-serif", "ui-monospace",
  "sans-serif", "serif", "monospace",
] as const;

const RADIUS_KEY = "radius";
const LETTER_SPACING_KEY = "letter-spacing";
const MIN_SWATCH = 3;
const MAX_SWATCH = 4;
const MAX_LABEL_LEN = 40;
const MAX_COLOR_LEN = 64;

// ── Layer 1: hard character blacklist — belt under every grammar check ──
// Any of these anywhere in a color/radius value is an instant reject,
// regardless of whether the grammar check below would also have caught it.
const BANNED_CHARS_RE = /[;{}<>@\\\n\r]|\/\*|\*\/|url\(|expression\(/i;

function hasBannedChars(raw: string): boolean {
  return BANNED_CHARS_RE.test(raw);
}

// ── Layer 2: real grammar, not a lone regex — parses the INSIDE of the
// color function, not just its outer shape. ──────────────────────────────
const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const COLOR_KEYWORDS = new Set(["transparent", "currentcolor", "inherit"]);
// Anchored full-string match with a NON-nesting paren body: this alone
// defeats "closes the function, appends more CSS" breakouts — there is
// nothing after `)` for `$` to match, and no interior `(` to smuggle another
// call. Function name is intentionally restricted to letters only.
const FUNCTION_RE = /^([a-zA-Z]+)\(([^()]*)\)$/;
const ALLOWED_FUNCTIONS = new Set(["oklch", "hsl", "hsla", "rgb", "rgba"]);

function parseNum(tok: string): number | null {
  // Bounded digit/decimal length so a token can't be an absurdly long
  // number string; plain (non-percent) numeric component.
  if (!/^\d{1,4}(\.\d{1,6})?$/.test(tok)) return null;
  const n = Number(tok);
  return Number.isFinite(n) ? n : null;
}

function isBoundedNum(tok: string, max: number, allowDeg = false): boolean {
  const t = allowDeg && tok.endsWith("deg") ? tok.slice(0, -3) : tok;
  const n = parseNum(t);
  return n !== null && n >= 0 && n <= max;
}

function isBoundedPercent(tok: string): boolean {
  if (!tok.endsWith("%")) return false;
  const n = parseNum(tok.slice(0, -1));
  return n !== null && n >= 0 && n <= 100;
}

function isAlphaToken(tok: string): boolean {
  if (isBoundedPercent(tok)) return true;
  return /^(0|1|0?\.\d{1,6})$/.test(tok);
}

function splitComponents(main: string): string[] {
  const trimmed = main.trim();
  if (trimmed.includes(",")) return trimmed.split(",").map((s) => s.trim());
  return trimmed.split(/\s+/).filter(Boolean);
}

function validColorFunction(fn: string, args: string): boolean {
  let mainPart = args;
  let alphaPart: string | null = null;
  const slashIdx = args.indexOf("/");
  if (slashIdx !== -1) {
    mainPart = args.slice(0, slashIdx);
    alphaPart = args.slice(slashIdx + 1).trim();
  }
  const comps = splitComponents(mainPart);
  if (alphaPart === null && comps.length === 4) {
    alphaPart = comps.pop() ?? null;
  }
  if (alphaPart !== null && !isAlphaToken(alphaPart)) return false;
  if (comps.length !== 3) return false;
  const [a, b, c] = comps;
  switch (fn) {
    case "oklch":
      // L: 0-1 or 0-100%; C: 0-1 (generous chroma bound); H: 0-360, optional deg.
      return (isBoundedNum(a, 1) || isBoundedPercent(a)) && isBoundedNum(b, 1) && isBoundedNum(c, 360, true);
    case "hsl":
    case "hsla":
      return isBoundedNum(a, 360, true) && isBoundedPercent(b) && isBoundedPercent(c);
    case "rgb":
    case "rgba":
      return (
        (isBoundedNum(a, 255) || isBoundedPercent(a)) &&
        (isBoundedNum(b, 255) || isBoundedPercent(b)) &&
        (isBoundedNum(c, 255) || isBoundedPercent(c))
      );
    default:
      return false;
  }
}

/** Strict color grammar per spec §4: oklch()/hsl()/hsla()/rgb()/rgba(), a
 *  hex triplet/sextet/octet, or a tiny safe keyword set. Hard-rejects the
 *  banned-character set FIRST (defense in depth even if a grammar hole
 *  existed), then requires the full string to be exactly one of the above —
 *  nothing before, nothing after. */
export function isValidColorValue(raw: unknown): raw is string {
  if (typeof raw !== "string") return false;
  if (raw.length === 0 || raw.length > MAX_COLOR_LEN) return false;
  if (raw.trim() !== raw) return false; // no smuggling via edge whitespace
  if (hasBannedChars(raw)) return false;
  if (HEX_RE.test(raw)) return true;
  if (COLOR_KEYWORDS.has(raw.toLowerCase())) return true;
  const m = FUNCTION_RE.exec(raw);
  if (!m) return false;
  const fn = m[1].toLowerCase();
  if (!ALLOWED_FUNCTIONS.has(fn)) return false;
  return validColorFunction(fn, m[2]);
}

const RADIUS_RE = /^(0|\d{1,3}(\.\d+)?(px|rem|em))$/;

/** `radius` grammar per spec §4 — a bare 0 or a bounded number + unit.
 *  Same banned-char + length belt as colors even though the regex alone
 *  already can't match anything containing those characters. */
export function isValidRadiusValue(raw: unknown): raw is string {
  if (typeof raw !== "string") return false;
  if (raw.length === 0 || raw.length > 16) return false;
  if (hasBannedChars(raw)) return false;
  return RADIUS_RE.test(raw);
}

// Signed, bounded number + unit (or bare "0", or the "normal" keyword) —
// same shape as radius but allows a leading '-' since letter-spacing is
// routinely negative (tighter tracking). Magnitude capped at 4 so nothing
// resembling a smuggled multi-declaration value can hide inside a "plausible"
// number, and the unit is restricted to the 3 CSS length units globals.css
// actually uses for it (em/rem/px) — never %, vh, vw, etc.
const LETTER_SPACING_RE = /^-?(0|\d{1,2}(\.\d{1,4})?)(px|rem|em)$/;

/** `letter-spacing` grammar (2026-08-25, the skin editor) — a signed bounded
 *  length or the literal "normal". Same banned-char + length belt as every
 *  other grammar in this module. */
export function isValidLetterSpacingValue(raw: unknown): raw is string {
  if (typeof raw !== "string") return false;
  if (raw.length === 0 || raw.length > 16) return false;
  if (hasBannedChars(raw)) return false;
  if (raw === "normal" || raw === "0") return true;
  if (!LETTER_SPACING_RE.test(raw)) return false;
  const numPart = raw.replace(/^-/, "").replace(/(px|rem|em)$/, "");
  return Number(numPart) <= 4; // bounded magnitude, belt over the regex's own cap
}

/** Font values are NEVER free strings — a fontKey must be an exact member of
 *  the allowlist or a generic system stack keyword. Exact-match membership
 *  (not a pattern) is the strongest possible defense: there is no grammar to
 *  break out of when the whole value must equal one of a fixed set. */
export function isValidFontKey(raw: unknown, config: SkinValidationConfig): raw is string {
  if (typeof raw !== "string") return false;
  if (config.fontFamilies.includes(raw)) return true;
  return (SYSTEM_FONT_STACK_KEYS as readonly string[]).includes(raw);
}

function resolveFontFamily(key: string, fallback: "sans-serif" | "serif" | "monospace"): string {
  if ((SYSTEM_FONT_STACK_KEYS as readonly string[]).includes(key)) return key;
  // key is guaranteed (by isValidFontKey, already run) to be an allowlisted
  // literal font name — the fallback keyword appended after it is OUR OWN
  // literal, never user input, exactly mirroring the vendored catalog's
  // "Inter, sans-serif" shape.
  return `${key}, ${fallback}`;
}

// ── The security boundary ────────────────────────────────────────────────

/**
 * Validate an untrusted skin payload against the fixed schema. Runs on WRITE
 * (submit route, reject bad input) and again on READ (resolveSkinTheme,
 * never trust a stored payload). Pure — no I/O, no throw; every rejection is
 * a collected error string so a submit UI can show all of them at once.
 */
export function validateSkinPayload(raw: unknown, config: SkinValidationConfig): SkinValidationResult {
  const errors: string[] = [];
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, errors: ["payload must be an object"] };
  }
  const obj = raw as Record<string, unknown>;

  const allowedTop = new Set(["label", "swatch", "light", "dark", "fontKey"]);
  for (const k of Object.keys(obj)) {
    if (!allowedTop.has(k)) errors.push(`unexpected field: ${k}`);
  }

  // label
  let label = "";
  if (typeof obj.label !== "string") {
    errors.push("label must be a string");
  } else if (/[\x00-\x1f\x7f]/.test(obj.label)) {
    errors.push("label contains control characters");
  } else {
    const trimmed = obj.label.trim();
    if (trimmed.length < 1 || trimmed.length > MAX_LABEL_LEN) {
      errors.push(`label must be 1-${MAX_LABEL_LEN} characters`);
    } else {
      label = trimmed;
    }
  }

  // swatch
  const validSwatch: string[] = [];
  if (!Array.isArray(obj.swatch) || obj.swatch.length < MIN_SWATCH || obj.swatch.length > MAX_SWATCH) {
    errors.push(`swatch must be an array of ${MIN_SWATCH}-${MAX_SWATCH} colors`);
  } else {
    obj.swatch.forEach((c: unknown, i: number) => {
      if (!isValidColorValue(c)) errors.push(`swatch[${i}] is not a valid color`);
      else validSwatch.push(c);
    });
  }

  // light / dark — every configured token key, no more, no less.
  function checkTokenMap(name: "light" | "dark"): Record<string, string> {
    const out: Record<string, string> = {};
    const map = obj[name];
    if (typeof map !== "object" || map === null || Array.isArray(map)) {
      errors.push(`${name} must be an object`);
      return out;
    }
    const mapObj = map as Record<string, unknown>;
    const remaining = new Set(Object.keys(mapObj));
    for (const key of config.tokenKeys) {
      if (!remaining.has(key)) {
        errors.push(`${name}.${key} is missing`);
        continue;
      }
      remaining.delete(key);
      const value = mapObj[key];
      const valid =
        key === RADIUS_KEY
          ? isValidRadiusValue(value)
          : key === LETTER_SPACING_KEY
            ? isValidLetterSpacingValue(value)
            : isValidColorValue(value); // shadow-color, agent-surface: plain colors
      if (!valid) errors.push(`${name}.${key} is not valid`);
      else out[key] = value as string;
    }
    for (const extra of remaining) errors.push(`${name}.${extra} is not a recognized token`);
    return out;
  }
  const light = checkTokenMap("light");
  const dark = checkTokenMap("dark");

  // fontKey
  const fontKey: SkinFontKeys = { sans: "", serif: "", mono: "", display: "" };
  if (typeof obj.fontKey !== "object" || obj.fontKey === null || Array.isArray(obj.fontKey)) {
    errors.push("fontKey must be an object");
  } else {
    const fkObj = obj.fontKey as Record<string, unknown>;
    const remaining = new Set(Object.keys(fkObj));
    for (const slot of ["sans", "serif", "mono", "display"] as const) {
      remaining.delete(slot);
      const value = fkObj[slot];
      if (!isValidFontKey(value, config)) errors.push(`fontKey.${slot} is not an allowlisted font`);
      else fontKey[slot] = value;
    }
    for (const extra of remaining) errors.push(`fontKey.${extra} is not a recognized slot`);
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, data: { label, swatch: validSwatch, light, dark, fontKey } };
}

/** The Theme-shaped object a skin resolves to — structurally identical to
 *  apps/web/lib/themes.ts's `Theme` (id/label/swatch/light/dark/font*), so a
 *  caller can hand this straight to the existing setTheme/themeCss path with
 *  zero new rendering code. Not literally importing that type (core has no
 *  import path to apps/web) — the fields match 1:1 by design. */
export interface SkinTheme {
  id: string;
  label: string;
  swatch: string[];
  light: Record<string, string>;
  dark: Record<string, string>;
  fontSans: string;
  fontSerif: string;
  fontMono: string;
  fontDisplay: string;
}

/**
 * Build a Theme from a stored skin row — RE-validating (never trust that
 * submit-time validation still holds; a schema could drift, a row could be
 * hand-edited). Fails CLOSED: any invalid payload, or a non-approved status,
 * returns null so the caller falls back to the default theme rather than
 * ever rendering something unvalidated.
 */
export function resolveSkinTheme(row: SkinRow, config: SkinValidationConfig): SkinTheme | null {
  if (row.status !== "approved") return null;
  const result = validateSkinPayload(row.payload, config);
  if (!result.ok) return null;
  const p = result.data;
  return {
    id: row.slug,
    label: p.label,
    swatch: p.swatch,
    light: p.light,
    dark: p.dark,
    fontSans: resolveFontFamily(p.fontKey.sans, "sans-serif"),
    fontSerif: resolveFontFamily(p.fontKey.serif, "serif"),
    fontMono: resolveFontFamily(p.fontKey.mono, "monospace"),
    fontDisplay: resolveFontFamily(p.fontKey.display, "sans-serif"),
  };
}

// ── Skin record ─────────────────────────────────────────────────────────
// PORTABILITY CUT: Sontara's DB data layer (createSkin/listSkins/moderation,
// Neon `sql`) is removed. A stored skin is now a plain record kept by a
// SkinStore (see skin-store.ts). `status` stays so resolveSkinTheme's
// fail-closed gate is unchanged; local skins are stored as "approved".

export type SkinStatus = "pending" | "approved" | "rejected" | "hidden";

export interface SkinRow {
  slug: string;
  name: string;
  payload: SkinPayload;
  status: SkinStatus;
}

const SLUG_RE = /^skin-[a-z0-9][a-z0-9-]{0,39}$/;

/** True for any id shaped like a skin slug. */
export function isSkinSlug(id: string): boolean {
  return SLUG_RE.test(id);
}

function slugifyName(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  return base || "s";
}

export function generateSkinSlug(name: string): string {
  const base = slugifyName(name);
  const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 6);
  return `skin-${base}-${suffix}`;
}
