import { describe, expect, it } from "vitest";

import { MODE_DRAWS, STATE_TO_MODE, resolvePreset, type OrbSize, type OrbState } from "./modes";

const STATES = Object.keys(STATE_TO_MODE) as OrbState[];
const SIZES: OrbSize[] = [64, 20];

function recorder() {
  const arcs: number[][] = [];
  let strokes = 0;
  const ctx = new Proxy(
    {},
    {
      get: (_t, k) =>
        k === "arc"
          ? (...a: number[]) => arcs.push(a)
          : k === "stroke"
            ? () => strokes++
            : () => {},
      set: () => true,
    },
  ) as unknown as CanvasRenderingContext2D;
  return { ctx, arcs, strokes: () => strokes };
}

describe("thinking-orbs port", () => {
  it.each(STATES.flatMap((s) => SIZES.map((z) => [s, z] as const)))(
    "%s @ %i draws finite dots in bounds, light and dark, across time",
    (state, size) => {
      const { mode, opts } = resolvePreset(state, size);
      for (const dark of [true, false]) {
        for (const t of [0, 0.6, 3.7, 41.2]) {
          const { ctx, arcs } = recorder();
          MODE_DRAWS[mode](ctx, size, t, dark, opts);
          expect(arcs.length).toBeGreaterThan(0);
          for (const [x, y, r] of arcs) {
            expect([x, y, r].every(Number.isFinite)).toBe(true);
            expect(x).toBeGreaterThanOrEqual(-2);
            expect(x).toBeLessThanOrEqual(size + 2);
            expect(y).toBeGreaterThanOrEqual(-2);
            expect(y).toBeLessThanOrEqual(size + 2);
          }
        }
      }
    },
  );

  it("connecting draws edges as well as dots", () => {
    const { mode, opts } = resolvePreset("connecting", 64);
    const { ctx, strokes } = recorder();
    MODE_DRAWS[mode](ctx, 64, 5, true, opts);
    expect(strokes()).toBeGreaterThan(0);
  });

  it("keeps the two tuned presets as distinct designs (spot-check against 0.2.0)", () => {
    expect(resolvePreset("working", 64)).toMatchObject({ mode: "orbits", speed: 1.885, opts: { orbitN: 12, ghostN: 40 } });
    expect(resolvePreset("working", 20)).toMatchObject({ speed: 3.9, opts: { orbitN: 3, ghostN: 10 } });
    expect(resolvePreset("breathing", 20).opts).toMatchObject({ faceOn: 1, ghostN: 0, bandMul: 3.968 });
    expect(resolvePreset("searching", 64).opts).toMatchObject({ scanMul: 4.08, dimBase: 0.45 });
  });
});
