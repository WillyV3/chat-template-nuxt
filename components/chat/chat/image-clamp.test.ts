import { describe, it, expect } from "vitest";
import { fitWithin, isClampable, MAX_IMAGE_EDGE } from "./image-clamp";

describe("fitWithin", () => {
  it("leaves an image that already fits untouched (never upscales)", () => {
    expect(fitWithin(800, 600)).toEqual({ w: 800, h: 600 });
    expect(fitWithin(2048, 100)).toEqual({ w: 2048, h: 100 });
    expect(fitWithin(10, 10)).toEqual({ w: 10, h: 10 });
  });

  it("scales the LONGEST edge to the cap and keeps aspect", () => {
    expect(fitWithin(4096, 2048)).toEqual({ w: 2048, h: 1024 });
    expect(fitWithin(1000, 5000)).toEqual({ w: 410, h: 2048 });
    // A phone photo: 4032×3024 → longest 4032 → 2048×1536.
    expect(fitWithin(4032, 3024)).toEqual({ w: 2048, h: 1536 });
  });

  it("honors a custom cap and never collapses to 0", () => {
    expect(fitWithin(3000, 1)).toEqual({ w: 2048, h: 1 });
    expect(fitWithin(100, 50, 10)).toEqual({ w: 10, h: 5 });
  });

  it("passes junk dimensions through unchanged", () => {
    expect(fitWithin(0, 0)).toEqual({ w: 0, h: 0 });
    expect(fitWithin(NaN, 10)).toEqual({ w: NaN, h: 10 });
  });

  it("the cap is the codex number", () => {
    expect(MAX_IMAGE_EDGE).toBe(2048);
  });
});

describe("isClampable", () => {
  it("only raster types a canvas re-encodes deterministically", () => {
    expect(isClampable("image/png")).toBe(true);
    expect(isClampable("image/jpeg")).toBe(true);
    expect(isClampable("image/webp")).toBe(true);
    expect(isClampable("image/svg+xml")).toBe(false);
    expect(isClampable("image/heic")).toBe(false);
    expect(isClampable("image/gif")).toBe(false); // animation would be flattened
  });
});
