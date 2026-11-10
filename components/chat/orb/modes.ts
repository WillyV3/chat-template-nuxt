/**
 * Vue/TypeScript port of the painters, presets and tuning tables of
 * `thinking-orbs` 0.2.0 (https://github.com/Jakubantalik/thinking-orbs).
 * The original ships React-only, minified; this is a de-minified transcription
 * of dist/index.es.js with identical maths, constants and presets.
 *
 * MIT License
 *
 * Copyright (c) 2026 Jakub Antalik
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

export type ModeKey =
  | "orbits" | "globe" | "rubik" | "wave" | "web" | "braid" | "ribbon" | "ring" | "morph";

/**
 * The nine shipped states, each a hand-tuned animation:
 * working (particles on tilted orbits), searching (scan meridian over a dotted
 * globe), solving (bands scramble in quarter turns), listening (waveform through
 * latitude rings), connecting (constellation wiring itself), weaving (three
 * strands plait), composing (undulating sash), breathing (face-on ring),
 * shaping (outline morphs circle -> triangle -> square).
 */
export type OrbState =
  | "working" | "searching" | "solving" | "listening" | "connecting"
  | "weaving" | "composing" | "breathing" | "shaping";

/** Exactly two tuned presets ship: 64 (chat avatar) and 20 (inline text). */
export type OrbSize = 64 | 20;

export type OrbTheme = "auto" | "dark" | "light";

export interface ModeOpts {
  [key: string]: number | undefined;
}

/** One frame painter: draws a mode into a 2D context at CSS-px `size`. */
export type ModeDraw = (
  ctx: CanvasRenderingContext2D,
  size: number,
  t: number,
  dark: boolean,
  opts: ModeOpts,
) => void;

export interface Resolved {
  mode: ModeKey;
  speed: number;
  opts: ModeOpts;
}

interface Dot {
  x: number;
  y: number;
  z: number;
  r: number;
  white: number;
  a?: number;
}

interface Line {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  white: number;
  a?: number;
  w: number;
}

type Vec3 = [number, number, number];

// ─── maths helpers ──────────────────────────────────────────────────────────

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const fract = (x: number) => x - Math.floor(x);

function hash(a: number, b: number): number {
  const s = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

/** 2D value noise (smoothstepped bilinear on the hash lattice). */
function noise(x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  let tx = x - xi;
  let ty = y - yi;
  tx = tx * tx * (3 - 2 * tx);
  ty = ty * ty * (3 - 2 * ty);
  const c = hash(xi, yi);
  const r = hash(xi + 1, yi);
  const l = hash(xi, yi + 1);
  const v = hash(xi + 1, yi + 1);
  return c + (r - c) * tx + (l - c) * ty + (c - r - l + v) * tx * ty;
}

/** Fibonacci sphere point i of n. */
function fib(i: number, n: number): Vec3 {
  const golden = Math.PI * (3 - Math.sqrt(5));
  const y = 1 - (2 * (i + 0.5)) / n;
  const rad = Math.sqrt(1 - y * y);
  const th = i * golden;
  return [rad * Math.cos(th), y, rad * Math.sin(th)];
}

function angDiff(a: number, b: number): number {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}

/** Yaw/pitch camera: rotate, then orthographic-project about (cx, cy). */
function makeView(yaw: number, pitch: number, cx: number, cy: number, scale: number) {
  const sp = Math.sin(pitch);
  const cp = Math.cos(pitch);
  const sy = Math.sin(yaw);
  const cyw = Math.cos(yaw);
  return (x: number, y: number, z: number): Vec3 => {
    const g = x * cyw + z * sy;
    const u = -x * sy + z * cyw;
    const h = y * cp - u * sp;
    const depth = y * sp + u * cp;
    return [cx + g * scale, cy - h * scale, depth];
  };
}

function drawDots(ctx: CanvasRenderingContext2D, dots: Dot[], dark: boolean, rMin = 0.3) {
  dots.sort((a, b) => a.z - b.z);
  for (const d of dots) {
    const alpha = d.a ?? 1;
    if (alpha < 0.02) continue;
    const w = Math.min(1, Math.max(0, d.white));
    const c = Math.round((dark ? 1 - w : w) * 255);
    ctx.fillStyle = `rgba(${c},${c},${c},${alpha})`;
    ctx.beginPath();
    ctx.arc(d.x, d.y, Math.max(rMin, d.r), 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawLines(ctx: CanvasRenderingContext2D, lines: Line[], dark: boolean) {
  for (const l of lines) {
    const alpha = l.a ?? 1;
    if (alpha < 0.02) continue;
    const w = Math.min(1, Math.max(0, l.white));
    const c = Math.round((dark ? 1 - w : w) * 255);
    ctx.strokeStyle = `rgba(${c},${c},${c},${alpha})`;
    ctx.lineWidth = l.w;
    ctx.beginPath();
    ctx.moveTo(l.x1, l.y1);
    ctx.lineTo(l.x2, l.y2);
    ctx.stroke();
  }
}

/** Dot-radius scale: grows with size^pow relative to a 300px reference. */
const sizeScale = (size: number, pow: number) => (size / 300) ** pow;

// ─── braid (weaving) ────────────────────────────────────────────────────────

const braid: ModeDraw = (ctx, n, s, dark, t) => {
  const cx = n / 2;
  const cy = n / 2;
  const r = (n / 2) * 0.76;
  const view = makeView(s * 0.4, 0.3, cx, cy, 1);
  const rs = sizeScale(n, t.rsPow ?? 0.6);
  const dots: Dot[] = [];
  const ghostN = t.ghostN ?? 150;
  for (let h = 0; h < ghostN; h++) {
    const p = fib(h, ghostN);
    const [x, y, z] = view(p[0] * r, p[1] * r, p[2] * r);
    const depth = (z / r + 1) / 2;
    dots.push({ x, y, z, r: 0.8 * rs, white: 0.78, a: 0.1 + 0.22 * depth });
  }
  const strandN = t.strandN ?? 52;
  const turns = t.turns ?? 3;
  for (let h = 0; h < 3; h++) {
    const phase = (h / 3) * 2 * Math.PI;
    for (let k = 0; k < strandN; k++) {
      const D = (fract(k / strandN + s * 0.045) * 2 - 1) * 0.96;
      const i = Math.sqrt(Math.max(0, 1 - D * D));
      const d = Math.min(1, (1 - Math.abs(D)) / 0.1);
      const y = D * Math.PI * turns + phase;
      const p = 1 + 0.075 * Math.sin(D * Math.PI * turns * 2 + phase * 2 + s * 0.8);
      const f = i * r * p;
      const [px, py, pz] = view(Math.cos(y) * f, D * r * p, Math.sin(y) * f);
      const M = (pz / r + 1) / 2;
      dots.push({
        x: px,
        y: py,
        z: pz,
        r: ((t.rBase ?? 1.2) + (t.rDepth ?? 1.8) * M) * rs,
        white: 0.55 - 0.45 * M,
        a: d * (0.45 + 0.55 * M),
      });
    }
  }
  drawDots(ctx, dots, dark, t.rMin);
};

// ─── rubik (solving) ────────────────────────────────────────────────────────

interface RubikMove {
  axis: number;
  lo: number;
  hi: number;
  ang: number;
}

/** Schedule: n moves forward, then n back, then a hold. */
function rubikSchedule(time: number, n: number, moveDur: number, hold: number) {
  const total = 2 * n * moveDur + hold;
  const e = time % total;
  const amount: number[] = new Array(n).fill(0);
  let active = -1;
  if (e < 2 * n * moveDur) {
    const l = Math.floor(e / moveDur);
    const v = (e - l * moveDur) / moveDur;
    const x = 1 - (1 - Math.min(1, v / 0.7)) ** 3;
    if (l < n) {
      for (let g = 0; g < l; g++) amount[g] = 1;
      amount[l] = x;
      active = l;
    } else {
      const g = 2 * n - 1 - l;
      for (let u = 0; u < g; u++) amount[u] = 1;
      amount[g] = 1 - x;
      active = g;
    }
  }
  return { amount, active };
}

function applyMoves(
  p: Vec3,
  moves: RubikMove[],
  sched: { amount: number[]; active: number },
): [number, number, number, boolean] {
  let [a, t, e] = p;
  let isActive = false;
  for (let r = 0; r < moves.length; r++) {
    if (sched.amount[r] <= 0) continue;
    const l = moves[r];
    const v = l.axis === 0 ? a : l.axis === 1 ? t : e;
    if (v < l.lo || v >= l.hi) continue;
    if (r === sched.active) isActive = true;
    const b = l.ang * sched.amount[r];
    const x = Math.cos(b);
    const g = Math.sin(b);
    if (l.axis === 0) {
      const u = t * x - e * g;
      e = t * g + e * x;
      t = u;
    } else if (l.axis === 1) {
      const u = a * x + e * g;
      e = -a * g + e * x;
      a = u;
    } else {
      const u = a * x - t * g;
      t = a * g + t * x;
      a = u;
    }
  }
  return [a, t, e, isActive];
}

function makeMoves(count: number): RubikMove[] {
  const out: RubikMove[] = [];
  for (let s = 0; s < count; s++) {
    const axis = Math.min(2, Math.floor(hash(s, 2.3) * 3));
    const lo = -1 + 0.5 * Math.min(3, Math.floor(hash(s, 5.9) * 4));
    const dir = hash(s, 7.7) < 0.5 ? 1 : -1;
    out.push({ axis, lo, hi: lo + 0.5, ang: (dir * Math.PI) / 2 });
  }
  return out;
}

const rubik: ModeDraw = (ctx, n, s, dark, t) => {
  const cx = n / 2;
  const cy = n / 2;
  const r = (n / 2) * 0.82;
  const view = makeView(s * 0.55, 0.35 + 0.1 * Math.sin(s * 0.9), cx, cy, r);
  const rs = sizeScale(n, t.rsPow ?? 0.6);
  const moveCount = t.moveCount ?? 14;
  const moves = makeMoves(moveCount);
  const sched = rubikSchedule(s, moveCount, 0.42, 1.2);
  const dots: Dot[] = [];
  const latRings = t.latRings ?? 15;
  const lonDensity = t.lonDensity ?? 40;
  for (let k = 0; k <= latRings; k++) {
    const lat = -Math.PI / 2 + (k / latRings) * Math.PI;
    const d = Math.cos(lat);
    const y = Math.sin(lat);
    const count = Math.max(1, Math.round(Math.abs(d) * lonDensity));
    for (let p = 0; p < count; p++) {
      const f = (p / count) * 2 * Math.PI;
      const [px, py, pz, act] = applyMoves([d * Math.cos(f), y, d * Math.sin(f)], moves, sched);
      const [sx, sy, sz] = view(px, py, pz);
      const I = (sz + 1) / 2;
      dots.push({
        x: sx,
        y: sy,
        z: sz,
        r: ((t.rBase ?? 0.6) + (t.rDepth ?? 1.7) * I + (act ? (t.rActive ?? 0.3) : 0)) * rs,
        white: (t.inkFar ?? 0.62) - (t.inkSpan ?? 0.54) * I - (act ? 0.14 : 0),
      });
    }
  }
  drawDots(ctx, dots, dark, t.rMin);
};

// ─── globe (searching) ──────────────────────────────────────────────────────

const globe: ModeDraw = (ctx, n, s, dark, t) => {
  const cx = n / 2;
  const cy = n / 2;
  const r = (n / 2) * 0.82;
  const tilt = 0.4 + 0.06 * Math.sin(s * 0.35);
  const view = makeView(s * 0.5, tilt, cx, cy, r);
  const scan = s * (0.5 + (1.7 - 0.5) * (t.scanMul ?? 1));
  const rs = sizeScale(n, t.rsPow ?? 0.6);
  const dim = t.dimBase ?? 1;
  const dots: Dot[] = [];
  const R = t.latRings ?? 17;
  const k = t.lonDensity ?? 44;
  for (let D = 0; D <= R; D++) {
    const lat = -Math.PI / 2 + (D / R) * Math.PI;
    const d = Math.cos(lat);
    const y = Math.sin(lat);
    const p = Math.max(1, Math.round(Math.abs(d) * k));
    for (let f = 0; f < p; f++) {
      const P = (f / p) * 2 * Math.PI;
      const [m, w, M] = view(d * Math.cos(P), y, d * Math.sin(P));
      const S = (M + 1) / 2;
      const N = angDiff(P + s * 0.5, scan);
      const E = Math.exp(-(N * N) / 0.18) * Math.max(0, M);
      dots.push({
        x: m,
        y: w,
        z: M,
        r: ((t.rBase ?? 0.6) + (t.rDepth ?? 1.7) * S + (t.rBoost ?? 1) * E) * rs,
        white: (t.inkFar ?? 0.62) - (t.inkSpan ?? 0.54) * S,
        // dimBase < 1 fades un-scanned dots so the meridian reads clearly
        a: dim + (1 - dim) * Math.min(1, E),
      });
    }
  }
  drawDots(ctx, dots, dark, t.rMin);
};

// ─── wave (listening) ───────────────────────────────────────────────────────

const wave: ModeDraw = (ctx, n, s, dark, t) => {
  const cx = n / 2;
  const cy = n / 2;
  const r = (n / 2) * 0.874;
  const view = makeView(s * 0.18, 0.38, cx, cy, 1);
  const rs = sizeScale(n, t.rsPow ?? 0.6);
  const dots: Dot[] = [];
  const rings = t.rings ?? 15;
  const lonDensity = t.lonDensity ?? 40;
  for (let u = 0; u <= rings; u++) {
    const lat = -Math.PI / 2 + (u / rings) * Math.PI;
    const R = Math.cos(lat);
    const k = Math.sin(lat);
    const D = 0.62 * Math.sin(s * 2.1 - u * 0.52) + 0.38 * Math.sin(s * 1.27 + u * 0.83);
    const i = r * (0.88 + 0.105 * D);
    const d = Math.max(1, Math.round(Math.abs(R) * lonDensity));
    for (let y = 0; y < d; y++) {
      const p = (y / d) * 2 * Math.PI;
      const [f, P, m] = view(R * Math.cos(p) * i, k * i, R * Math.sin(p) * i);
      const w = (m / r + 1) / 2;
      const M = Math.max(0, D);
      dots.push({
        x: f,
        y: P,
        z: m,
        r: ((t.rBase ?? 0.6) + (t.rDepth ?? 1.7) * w) * (1 + 0.4 * M) * rs,
        white: 0.66 - 0.56 * w - 0.1 * M,
      });
    }
  }
  drawDots(ctx, dots, dark, t.rMin);
};

// ─── morph (shaping) ────────────────────────────────────────────────────────

const smoothstep = (x: number) => x * x * (3 - 2 * x);

type Pt = [number, number];

/** Closed polyline sampler: t in [0,1] -> point along the perimeter. */
function polyPath(pts: Pt[]) {
  const n = pts.length;
  const lens: number[] = [];
  let total = 0;
  for (let t = 0; t < n; t++) {
    const a = pts[t];
    const b = pts[(t + 1) % n];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    lens.push(len);
    total += len;
  }
  return (t: number): Pt => {
    let e = t * total;
    let c = 0;
    while (e > lens[c] && c < n - 1) {
      e -= lens[c];
      c++;
    }
    const a = pts[c];
    const b = pts[(c + 1) % n];
    const v = lens[c] ? Math.min(1, e / lens[c]) : 0;
    return [a[0] + (b[0] - a[0]) * v, a[1] + (b[1] - a[1]) * v];
  };
}

const circlePath = (o: number): Pt => {
  const a = -Math.PI / 2 + o * 2 * Math.PI;
  return [Math.cos(a) * 0.24, Math.sin(a) * 0.24];
};
const trianglePath = polyPath([
  [0, -0.26],
  [0.24, 0.16],
  [-0.24, 0.16],
]);
const squarePath = polyPath([
  [0, -0.2],
  [0.2, -0.2],
  [0.2, 0.2],
  [-0.2, 0.2],
  [-0.2, -0.2],
]);
const SHAPES = [circlePath, trianglePath, squarePath];

const morphDotCount = (o: number) => Math.max(6, Math.round(34 * o));
const HOLD = 1.4;
const MORPH = 0.9;
const CYCLE = HOLD + MORPH;

const morph: ModeDraw = (ctx, n, s, dark, t) => {
  const shapeN = SHAPES.length;
  const c = s % (CYCLE * shapeN);
  const idx = Math.floor(c / CYCLE);
  const l = c - idx * CYCLE;
  const v = l > HOLD ? smoothstep((l - HOLD) / MORPH) : 0;
  const spread = t.spread ?? 1;
  const from = SHAPES[idx];
  const to = SHAPES[(idx + 1) % shapeN];
  const u = 160;
  const h: Pt[] = [];
  for (let m = 0; m < u; m++) {
    const w = m / u;
    const a = from(w);
    const b = to(w);
    h.push([(a[0] + (b[0] - a[0]) * v) * spread, (a[1] + (b[1] - a[1]) * v) * spread]);
  }
  const segLens: number[] = [];
  let total = 0;
  for (let m = 0; m < u; m++) {
    const w = h[m];
    const M = h[(m + 1) % u];
    const len = Math.hypot(M[0] - w[0], M[1] - w[1]);
    segLens.push(len);
    total += len;
  }
  const D = morphDotCount(t.iconD ?? 1);
  const i = (t.rDot ?? 0.021) * 1.35 * spread;
  const d = 1 + 0.02 * Math.sin(l * 3.1);
  const dots: Dot[] = [];
  const p = n / 2;
  let f = 0;
  let P = 0;
  for (let m = 0; m < D; m++) {
    const w = (m / D) * total;
    while (P + segLens[f] < w && f < u - 1) {
      P += segLens[f];
      f++;
    }
    const M = h[f];
    const S = h[(f + 1) % u];
    const N = segLens[f] ? Math.min(1, (w - P) / segLens[f]) : 0;
    const E = (M[0] + (S[0] - M[0]) * N) * d;
    const I = (M[1] + (S[1] - M[1]) * N) * d;
    dots.push({ x: p + E * n, y: p + I * n, z: 0, r: Math.max(0.35, i * n), white: 0.1 });
  }
  drawDots(ctx, dots, dark, t.rMin);
};

// ─── orbits (working) ───────────────────────────────────────────────────────

const orbits: ModeDraw = (ctx, n, s, dark, t) => {
  const cx = n / 2;
  const cy = n / 2;
  const r = (n / 2) * 0.82;
  const view = makeView(s * 0.12, 0.3, cx, cy, 1);
  const rs = sizeScale(n, t.rsPow ?? 0.6);
  const dots: Dot[] = [];
  const orbitN = t.orbitN ?? 12;
  const ghostN = t.ghostN ?? 40;
  const particles = t.particles ?? 3;
  for (let h = 0; h < orbitN; h++) {
    const R = hash(h, 1.7);
    const k = hash(h, 5.2);
    const D = hash(h, 8.9);
    const i = r * (0.45 + 0.52 * R);
    const d = R * 2 * Math.PI;
    const y = Math.acos(2 * k - 1);
    // orbit normal
    const p = Math.sin(y) * Math.cos(d);
    const f = Math.cos(y);
    const P = Math.sin(y) * Math.sin(d);
    // first in-plane axis
    let m = -f;
    let w = p;
    const M = 0;
    const S = Math.max(1e-6, Math.sqrt(m * m + w * w));
    m /= S;
    w /= S;
    // second in-plane axis = normal x first
    const N = f * M - P * w;
    const E = P * m - p * M;
    const I = p * w - f * m;
    const O = (0.25 + 0.55 * D) * (D > 0.5 ? 1 : -1);
    for (let A = 0; A < ghostN; A++) {
      const L = (A / ghostN) * 2 * Math.PI;
      const [z, C, F] = view(
        (m * Math.cos(L) + N * Math.sin(L)) * i,
        (w * Math.cos(L) + E * Math.sin(L)) * i,
        (M * Math.cos(L) + I * Math.sin(L)) * i,
      );
      const T = (F / i + 1) / 2;
      dots.push({
        x: z,
        y: C,
        z: F,
        r: (t.ghostR ?? 0.9) * rs,
        white: 0.72,
        a: (t.ghostA ?? 0.5) * (0.4 + 0.6 * T),
      });
    }
    for (let A = 0; A < particles; A++) {
      const L = s * O + (A / particles) * 2 * Math.PI + k * 6;
      const [z, C, F] = view(
        (m * Math.cos(L) + N * Math.sin(L)) * i,
        (w * Math.cos(L) + E * Math.sin(L)) * i,
        (M * Math.cos(L) + I * Math.sin(L)) * i,
      );
      const T = (F / i + 1) / 2;
      dots.push({
        x: z,
        y: C,
        z: F,
        r: ((t.partR ?? 1.2) + (t.partRDepth ?? 1.6) * T) * rs,
        white: 0.3 - 0.22 * T,
      });
    }
  }
  drawDots(ctx, dots, dark, t.rMin);
};

// ─── ribbon (composing) / ring (breathing) ──────────────────────────────────

const ribbon: ModeDraw = (ctx, n, s, dark, t) => {
  const cx = n / 2;
  const cy = n / 2;
  const r = (n / 2) * 0.78;
  const spin = t.spin ?? 1;
  const pitch = 0.3;
  const view = makeView(s * 0.1 * spin, pitch, cx, cy, 1);
  const rs = sizeScale(n, t.rsPow ?? 0.6);
  const dots: Dot[] = [];
  const ghostN = t.ghostN ?? 150;
  for (let I = 0; I < ghostN; I++) {
    const O = fib(I, ghostN);
    const [x, y, z] = view(O[0] * r, O[1] * r, O[2] * r);
    const C = (z / r + 1) / 2;
    dots.push({ x, y, z, r: 0.8 * rs, white: 0.78, a: 0.1 + 0.22 * C });
  }
  const h = s * 0.24 * spin;
  const R = t.faceOn ? -pitch : 0.55 + 0.3 * Math.sin(s * 0.18) * spin;
  const k = Math.cos(h);
  const D = 0;
  const i = Math.sin(h);
  const d = -i * Math.sin(R);
  const y = Math.cos(R);
  const p = k * Math.sin(R);
  const f = D * p - i * y;
  const P = i * d - k * p;
  const m = k * y - D * d;
  const w = 0.23 * (t.wobMul ?? 1);
  const M = t.faceOn ? r / (1 + 0.85 * w) : r;
  const lanes = t.lanes ?? 5;
  const segs = t.segs ?? 88;
  const E = Math.max(1, Math.round(lanes * (t.bandMul ?? 1)));
  for (let I = 0; I < E; I++) {
    const O = (I - (E - 1) / 2) * 0.075;
    const A = Math.abs(I - (E - 1) / 2) / Math.max(1, (E - 1) / 2);
    for (let L = 0; L < segs; L++) {
      const z = (L / segs) * 2 * Math.PI;
      const C =
        (0.16 * Math.sin(z * 3 - s * 1.7 + I * 0.22) + 0.07 * Math.sin(z * 5 + s * 1.1)) *
        (t.wobMul ?? 1);
      const F = t.faceOn ? 1 + C : 1;
      const T = t.faceOn ? O : O + C;
      const W = k * Math.cos(z) + d * Math.sin(z) + f * T;
      const j = D * Math.cos(z) + y * Math.sin(z) + P * T;
      const Y = i * Math.cos(z) + p * Math.sin(z) + m * T;
      const K = Math.sqrt(W * W + j * j + Y * Y);
      const U = M * F;
      const [px, py, pz] = view((W / K) * U, (j / K) * U, (Y / K) * U);
      const G = (pz / r + 1) / 2;
      dots.push({
        x: px,
        y: py,
        z: pz,
        r: ((t.rBase ?? 1.1) + (t.rDepth ?? 1.7) * G) * (1 - 0.25 * A) * rs,
        white: 0.52 - 0.44 * G + 0.18 * A,
        a: 0.4 + 0.6 * G,
      });
    }
  }
  drawDots(ctx, dots, dark, t.rMin);
};

// ─── web (connecting) ───────────────────────────────────────────────────────

const web: ModeDraw = (ctx, n, s, dark, t) => {
  const cx = n / 2;
  const cy = n / 2;
  const r = (n / 2) * 0.8 * (t.spread ?? 1);
  const view = makeView(s * 0.12, 0.32, cx, cy, r);
  const rs = sizeScale(n, t.rsPow ?? 0.6);
  const nodeN = t.nodeN ?? 30;
  const thr = t.thr ?? 0.72;
  const nodeR = t.nodeR ?? 1.4;
  const nodeRDepth = t.nodeRDepth ?? 1.8;
  const nodes: Vec3[] = [];
  for (let i = 0; i < nodeN; i++) {
    const d = fib(i, nodeN);
    const y = d[0] + 0.3 * (noise(i * 0.31 + 9, s * 0.24) - 0.5) * 2;
    const p = d[1] + 0.3 * (noise(i * 0.53 + 27, s * 0.21) - 0.5) * 2;
    const f = d[2] + 0.3 * (noise(i * 0.77 + 55, s * 0.27) - 0.5) * 2;
    const P = Math.sqrt(y * y + p * p + f * f);
    nodes.push([y / P, p / P, f / P]);
  }
  const lines: Line[] = [];
  const dots: Dot[] = [];
  for (let i = 0; i < nodeN; i++) {
    for (let d = i + 1; d < nodeN; d++) {
      const y = nodes[i][0] - nodes[d][0];
      const p = nodes[i][1] - nodes[d][1];
      const f = nodes[i][2] - nodes[d][2];
      const P = Math.sqrt(y * y + p * p + f * f);
      if (P >= thr) continue;
      const [m, w, M] = view(nodes[i][0], nodes[i][1], nodes[i][2]);
      const [S, N, E] = view(nodes[d][0], nodes[d][1], nodes[d][2]);
      const I = ((M + E) / 2 + 1) / 2;
      lines.push({
        x1: m,
        y1: w,
        x2: S,
        y2: N,
        white: 0.42,
        a: (1 - P / thr) * (0.3 + 0.55 * I),
        w: Math.max(0.6, (t.lineW ?? 0.8) * rs),
      });
    }
  }
  for (let i = 0; i < nodeN; i++) {
    const [d, y, p] = view(nodes[i][0], nodes[i][1], nodes[i][2]);
    const f = (p + 1) / 2;
    const P = 1 + 0.25 * Math.sin(s * 1.4 + i * 2.7);
    dots.push({ x: d, y, z: p, r: (nodeR + nodeRDepth * f) * P * rs, white: 0.55 - 0.45 * f });
  }
  const signals = t.signals ?? 5;
  for (let i = 0; i < signals; i++) {
    const d = Math.floor(s * 0.55 + i * 7.31);
    const y = Math.floor(hash(d, i * 3.1 + 1.7) * nodeN);
    const p = Math.floor(hash(d, i * 5.7 + 4.2) * nodeN);
    if (y === p) continue;
    const f = fract(s * 0.55 + i * 7.31);
    const P = lerp(nodes[y][0], nodes[p][0], f);
    const m = lerp(nodes[y][1], nodes[p][1], f);
    const w = lerp(nodes[y][2], nodes[p][2], f);
    const M = Math.max(1e-6, Math.sqrt(P * P + m * m + w * w));
    const [S, N, E] = view(P / M, m / M, w / M);
    const I = (E + 1) / 2;
    dots.push({
      x: S,
      y: N,
      z: E,
      r: (nodeR * 1.5 + nodeRDepth * I) * rs,
      white: 0.05,
      a: 0.5 + 0.5 * I,
    });
  }
  drawLines(ctx, lines, dark);
  drawDots(ctx, dots, dark, t.rMin);
};

export const MODE_DRAWS: Record<ModeKey, ModeDraw> = {
  orbits,
  globe,
  rubik,
  wave,
  web,
  braid,
  ribbon,
  // ring shares ribbon's painter; the `faceOn` profile flag switches it
  ring: ribbon,
  morph,
};

// ─── presets ────────────────────────────────────────────────────────────────

/** Pairs scaled together by sqrt(count) (rings x per-ring density). */
const COUNT_PAIRS: string[][] = [
  ["latRings", "lonDensity"],
  ["rings", "lonDensity"],
  ["lanes", "segs"],
];
const COUNT_SINGLES = ["orbitN", "ghostN", "nodeN", "strandN", "signals"];
const COUNT_FRACTIONAL = ["iconD"];
const SIZE_KEYS = [
  "rBase", "rDepth", "rActive", "rDot", "ghostR", "partR", "partRDepth", "nodeR", "nodeRDepth",
];

function scaleCounts(o: ModeOpts, n: number): ModeOpts {
  const s: ModeOpts = { ...o };
  const done = new Set<string>();
  const root = Math.sqrt(n);
  for (const [a, b] of COUNT_PAIRS) {
    const x = s[a];
    const y = s[b];
    if (x != null && y != null && !done.has(a) && !done.has(b)) {
      s[a] = Math.max(2, Math.round(x * root));
      s[b] = Math.max(2, Math.round(y * root));
      done.add(a);
      done.add(b);
    }
  }
  for (const k of COUNT_SINGLES) {
    const v = s[k];
    if (v != null && v !== 0 && !done.has(k)) s[k] = Math.max(1, Math.round(v * n));
  }
  for (const k of COUNT_FRACTIONAL) {
    const v = s[k];
    if (v != null) s[k] = Math.max(0.02, v * n);
  }
  return s;
}

function scaleSizes(o: ModeOpts, n: number): ModeOpts {
  const s: ModeOpts = { ...o };
  for (const k of SIZE_KEYS) {
    const v = s[k];
    if (v != null) s[k] = v * n;
  }
  s.rSizeMul = (s.rSizeMul ?? 1) * n;
  return s;
}

/** Base ("profile") options per mode, before the per-size preset scales them. */
const PROFILES: Record<ModeKey, ModeOpts> = {
  globe: {
    latRings: 17, lonDensity: 44, rBase: 0.6, rDepth: 1.7, rBoost: 1,
    inkFar: 0.62, inkSpan: 0.54, rsPow: 0.6, rMin: 0.3,
  },
  orbits: {
    orbitN: 12, ghostN: 40, ghostR: 0.9, ghostA: 0.5, particles: 3,
    partR: 1.2, partRDepth: 1.6, rsPow: 0.6, rMin: 0.3,
  },
  rubik: {
    latRings: 15, lonDensity: 40, moveCount: 14, rBase: 0.6, rDepth: 1.7, rActive: 0.3,
    inkFar: 0.62, inkSpan: 0.54, rsPow: 0.6, rMin: 0.3,
  },
  wave: { rings: 15, lonDensity: 40, rBase: 0.6, rDepth: 1.7, rsPow: 0.6, rMin: 0.3 },
  web: {
    nodeN: 30, thr: 0.72, signals: 5, nodeR: 1.4, nodeRDepth: 1.8, lineW: 0.8,
    rsPow: 0.6, rMin: 0.3,
  },
  braid: { strandN: 52, turns: 3, ghostN: 150, rBase: 1.2, rDepth: 1.8, rsPow: 0.6, rMin: 0.3 },
  ribbon: { lanes: 5, segs: 88, ghostN: 150, rBase: 1.1, rDepth: 1.7, rsPow: 0.6, rMin: 0.3 },
  // ring shares ribbon's painter; faceOn cancels the camera tilt and moves
  // the undulation onto the radius, and there is no ghost sphere behind it
  ring: {
    lanes: 5, segs: 88, ghostN: 0, faceOn: 1, rBase: 1.1, rDepth: 1.7, rsPow: 0.6, rMin: 0.3,
  },
  morph: { rDot: 0.021, iconD: 1, rMin: 0.25 },
};

export const STATE_TO_MODE: Record<OrbState, ModeKey> = {
  working: "orbits",
  searching: "globe",
  solving: "rubik",
  listening: "wave",
  connecting: "web",
  weaving: "braid",
  composing: "ribbon",
  breathing: "ring",
  shaping: "morph",
};

interface SizePreset {
  speed: number;
  count: number;
  size: number;
  extra?: ModeOpts;
}

/** The hand-tuned 64 / 20 presets: separate designs, not a scale factor. */
const PRESETS: Record<ModeKey, Record<OrbSize, SizePreset>> = {
  orbits: {
    64: { speed: 1.885, count: 1, size: 1 },
    20: { speed: 3.9, count: 0.238, size: 2.4 },
  },
  globe: {
    64: { speed: 2.015, count: 0.42, size: 1.15, extra: { scanMul: 4.08, dimBase: 0.45 } },
    20: { speed: 2.665, count: 0.105, size: 1.75, extra: { scanMul: 4.335, dimBase: 0.45 } },
  },
  rubik: {
    64: { speed: 1.82, count: 0.35, size: 1.05 },
    20: { speed: 1.95, count: 0.088, size: 1.9 },
  },
  wave: {
    64: { speed: 4.388, count: 0.341, size: 1 },
    20: { speed: 3.998, count: 0.105, size: 1.6 },
  },
  web: {
    64: { speed: 3.315, count: 1.35, size: 0.95 },
    20: { speed: 6.63, count: 0.25, size: 1.52 },
  },
  braid: {
    64: { speed: 1.625, count: 0.5, size: 1 },
    20: { speed: 2.75, count: 0.1125, size: 1.36 },
  },
  ribbon: {
    64: { speed: 2.34, count: 0.25, size: 0.85, extra: { spin: 0, bandMul: 3.9, wobMul: 1 } },
    20: { speed: 3.12, count: 0.051, size: 1.073, extra: { spin: 0, bandMul: 4.94, wobMul: 1 } },
  },
  ring: {
    64: { speed: 3.24, count: 0.25, size: 0.956, extra: { spin: 0, bandMul: 3.627, wobMul: 0.368 } },
    20: { speed: 3.78, count: 0.028, size: 1.622, extra: { spin: 0, bandMul: 3.968, wobMul: 0.565 } },
  },
  morph: {
    64: { speed: 2.405, count: 0.702, size: 0.395, extra: { spread: 1.45 } },
    20: { speed: 2.08, count: 0.53, size: 1.011, extra: { spread: 1.45 } },
  },
};

const presetCache = new Map<string, Resolved>();

/** Resolve a (state, size) pair to its mode + fully-scaled draw options. */
export function resolvePreset(state: OrbState, size: OrbSize): Resolved {
  const key = `${state}-${size}`;
  const hit = presetCache.get(key);
  if (hit) return hit;
  const mode = STATE_TO_MODE[state];
  const p = PRESETS[mode][size];
  let opts: ModeOpts = { ...PROFILES[mode] };
  if (p.count !== 1) opts = scaleCounts(opts, p.count);
  if (p.size !== 1) opts = scaleSizes(opts, p.size);
  if (p.extra) opts = { ...opts, ...p.extra };
  const out: Resolved = { mode, speed: p.speed, opts };
  presetCache.set(key, out);
  return out;
}

/** Default aria-label per state (the package's own). */
export const ORB_ARIA_LABELS: Record<OrbState, string> = {
  working: "Working…",
  searching: "Searching…",
  solving: "Solving…",
  listening: "Listening…",
  connecting: "Connecting…",
  weaving: "Weaving…",
  composing: "Composing…",
  breathing: "Thinking…",
  shaping: "Shaping…",
};
