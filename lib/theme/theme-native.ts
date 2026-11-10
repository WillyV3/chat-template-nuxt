// Native (React Native) view of the theme catalog: RN has no oklch/hsl parser,
// so every token becomes #rrggbb and radius becomes px. Pure; imports only the catalog.
import { THEME_TOKEN_KEYS, type Theme } from "./themes";

const hex2 = (n: number) => Math.round(Math.min(1, Math.max(0, n)) * 255).toString(16).padStart(2, "0");
const toHex = (r: number, g: number, b: number) => `#${hex2(r)}${hex2(g)}${hex2(b)}`;

function num(s: string, pctScale = 1): number {
  const t = s.trim();
  if (t === "none") return 0;
  const v = t.endsWith("%") ? (parseFloat(t) / 100) * pctScale : parseFloat(t);
  if (!Number.isFinite(v)) throw new Error(`theme-native: bad number "${s}"`);
  return v;
}

/** Split "a b c / d" or "a, b, c, d" into the colour channels (alpha dropped). A 4th
 *  component is alpha — core's skin validator (skins.ts validColorFunction) accepts
 *  "rgba(1, 2, 3, 0.5)" and "rgb(1 2 3 0.5)", so an approved skin can carry it. */
function args(inner: string): string[] {
  const noAlpha = inner.includes("/") ? inner.split("/")[0] : inner;
  const parts = noAlpha.split(/[\s,]+/).filter(Boolean);
  return parts.length === 4 ? parts.slice(0, 3) : parts;
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)];
}

function oklchToRgb(L: number, C: number, hDeg: number): [number, number, number] {
  const h = (hDeg * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l_ = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const lin = [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
  // ponytail: clip, not chroma-reduction gamut mapping — upgrade if clipped catalog colours look wrong on device
  return lin.map((c) => {
    const x = Math.min(1, Math.max(0, c));
    return x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
  }) as [number, number, number];
}

/** Any catalog/skin colour syntax -> lowercase #rrggbb. Unknown syntax throws — including the
 *  keywords core's skin validator allows (transparent/currentcolor/inherit): they have no honest
 *  #rrggbb, so the PHONE guards (apps/mobile/lib/skin-context.tsx converts before applying). */
export function cssColorToHex(value: string): string {
  const v = value.trim().toLowerCase();
  const hexm = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(v);
  if (hexm) {
    const h = hexm[1];
    if (h.length === 3) return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`;
    return `#${h.slice(0, 6)}`;
  }
  const fn = /^(hsla?|rgba?|oklch)\(([^)]*)\)$/.exec(v);
  if (fn) {
    const p = args(fn[2]);
    if (fn[1] === "oklch" && p.length === 3) return toHex(...oklchToRgb(num(p[0]), num(p[1], 0.4), num(p[2])));
    if (fn[1].startsWith("hsl") && p.length === 3) {
      return toHex(...hslToRgb(((num(p[0]) % 360) + 360) % 360, num(p[1]), num(p[2])));
    }
    if (fn[1].startsWith("rgb") && p.length === 3) {
      const [r, g, b] = p.map((c) => (c.endsWith("%") ? num(c) : num(c) / 255));
      return toHex(r, g, b);
    }
  }
  throw new Error(`theme-native: unsupported colour "${value}"`);
}

type Camel<S extends string> = S extends `${infer A}-${infer B}` ? `${A}${Capitalize<Camel<B>>}` : S;
type ColourKey = Exclude<(typeof THEME_TOKEN_KEYS)[number], "radius">;

export type NativeTokens = { [K in ColourKey as Camel<K>]: string } & { radius: number };

const camel = (k: string) => k.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());

function radiusPx(v: string): number {
  const t = v.trim();
  const n = parseFloat(t);
  if (!Number.isFinite(n)) throw new Error(`theme-native: bad radius "${v}"`);
  if (t.endsWith("em")) return n * 16; // rem and em (skins.ts RADIUS_RE allows both); 16 = web's root size
  if (t.endsWith("px") || n === 0) return n;
  throw new Error(`theme-native: unsupported radius "${v}"`);
}

export function toNativeTokens(theme: Theme, scheme: "light" | "dark"): NativeTokens {
  const src = theme[scheme] as Record<string, string>;
  const out: Record<string, string | number> = {};
  for (const k of THEME_TOKEN_KEYS) {
    out[camel(k)] = k === "radius" ? radiusPx(src[k]) : cssColorToHex(src[k]);
  }
  return out as NativeTokens;
}

/** "#rrggbb" -> "h s% l%": the channel form apps/mobile/tailwind.config.js's `hsl(var(--x))` expects,
 *  so NativeWind's runtime vars() can re-skin className colours. */
export function hexToHslTriplet(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d !== 0) {
    h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/** `--radius` is a NUMBER (px): NativeWind's calc() (`rounded-md` = calc(var(--radius) - 2px)) only
 *  resolves numeric operands, so a "8px" string would silently drop every rounded-* class. */
export type NativeVars = Record<`--${ColourKey}`, string> & { "--radius": number };

/** CSS-var form for NativeWind vars(): HSL triplets + radius as a px number. */
export function toNativeVars(theme: Theme, scheme: "light" | "dark"): NativeVars {
  const src = theme[scheme];
  const out: Record<string, string | number> = {};
  for (const k of THEME_TOKEN_KEYS) {
    out[`--${k}`] = k === "radius" ? radiusPx(src[k]) : hexToHslTriplet(cssColorToHex(src[k]));
  }
  return out as NativeVars;
}
