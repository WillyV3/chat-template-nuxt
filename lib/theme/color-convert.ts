// Pure hex <-> oklch conversion for the skin editor's color picker (spec:
// "each token needs a real color picker (hex + oklch)"). NOT a security
// boundary — validateSkinPayload (packages/core/src/skins.ts) is the only
// gate a value has to pass to actually save; this module just gives the UI a
// two-way street between what a native <input type="color"> speaks (hex) and
// what most of the vendored theme catalog is authored in (oklch), using the
// standard CSS Color 4 / Björn Ottosson OKLab matrices (no dependency — this
// is ~30 lines of well-published linear algebra, not a library's worth of
// surface area).
//
// Every value THIS module formats is deliberately shaped to already satisfy
// core's color grammar (6-digit lowercase hex; oklch() with plain
// space-separated bounded numbers) — so round-tripping through the picker
// never produces something the submit boundary would reject.

export interface Rgb {
  r: number; // 0-255
  g: number;
  b: number;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function srgbToLinear(c: number): number {
  const cs = c / 255;
  return cs <= 0.04045 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
}

function linearToSrgb(c: number): number {
  const v = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(clamp(c, 0, 1), 1 / 2.4) - 0.055;
  return Math.round(clamp(v, 0, 1) * 255);
}

function linearSrgbToOklab(r: number, g: number, b: number): { L: number; a: number; b: number } {
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);
  return {
    L: 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    a: 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  };
}

function oklabToLinearSrgb(L: number, a: number, b: number): Rgb {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  return {
    r: linearToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    g: linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    b: linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  };
}

const HEX_INPUT_RE = /^#?([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/;

/** Parse a #rgb/#rrggbb hex string (the # is optional on input). Returns
 *  null for anything else — callers fall back to leaving the field alone
 *  rather than guessing. */
export function parseHex(raw: string): Rgb | null {
  const m = HEX_INPUT_RE.exec(raw.trim());
  if (!m) return null;
  let hex = m[1];
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((c) => c + c)
      .join("");
  }
  const n = parseInt(hex, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const h = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

function round(n: number, places: number): number {
  const f = 10 ** places;
  return Math.round(n * f) / f;
}

/** hex -> "oklch(L C H)" in the exact shape core's color grammar accepts
 *  (space-separated, no alpha, bounded numbers). */
export function hexToOklch(hex: string): string | null {
  const rgb = parseHex(hex);
  if (!rgb) return null;
  const lin = { r: srgbToLinear(rgb.r), g: srgbToLinear(rgb.g), b: srgbToLinear(rgb.b) };
  const lab = linearSrgbToOklab(lin.r, lin.g, lin.b);
  const C = Math.sqrt(lab.a * lab.a + lab.b * lab.b);
  let H = (Math.atan2(lab.b, lab.a) * 180) / Math.PI;
  if (H < 0) H += 360;
  const L = clamp(lab.L, 0, 1);
  return `oklch(${round(L, 4)} ${round(C, 4)} ${round(H, 4)})`;
}

const OKLCH_INPUT_RE = /^oklch\(\s*([\d.]+)%?\s+([\d.]+)\s+([\d.]+)(?:deg)?\s*\)$/i;

/** "oklch(L C H)" (L may be 0-1 or a %) -> hex. Returns null for anything
 *  that doesn't parse as 3 plain, IN-BOUNDS numbers (same bounds core's
 *  isValidColorValue enforces: L/C 0-1, H 0-360) — the picker falls back to
 *  the last good hex rather than accepting a value the security boundary
 *  would reject anyway at submit time. */
export function oklchToHex(raw: string): string | null {
  const m = OKLCH_INPUT_RE.exec(raw.trim());
  if (!m) return null;
  const isPercent = raw.includes("%");
  const L = isPercent ? Number(m[1]) / 100 : Number(m[1]);
  const C = Number(m[2]);
  const H = Number(m[3]);
  if (![L, C, H].every(Number.isFinite)) return null;
  if (L < 0 || L > 1 || C < 0 || C > 1 || H < 0 || H > 360) return null;
  const rad = (H * Math.PI) / 180;
  const a = C * Math.cos(rad);
  const b = C * Math.sin(rad);
  const rgb = oklabToLinearSrgb(L, a, b);
  return rgbToHex(rgb);
}

/** True for a string this module's oklchToHex can parse — used by the picker
 *  to decide whether to show a value in the oklch field as-is or convert it
 *  first (a token might already be hex, hsl(), or a keyword). */
export function isParseableOklch(raw: string): boolean {
  return OKLCH_INPUT_RE.test(raw.trim());
}
