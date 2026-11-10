import { describe, it, expect } from "vitest";
import { isValidRadiusValue, isValidLetterSpacingValue } from "@/lib/theme/skins-core";
import { formatRadius, formatLetterSpacing } from "./typography-controls";

// The radius/letter-spacing sliders format a raw JS float straight into the
// string validateSkinPayload will see. Floats drift (0.05 * 6 =
// 0.30000000000000004); this proves EVERY value across the sliders' full
// step range still passes the real security grammar, not just spot-checked
// ones.
describe("slider formatting never produces a value the security grammar rejects", () => {
  it("formatRadius: every 0.05rem step from 0 to 2 is a valid radius value", () => {
    for (let i = 0; i <= 40; i++) {
      const v = i * 0.05;
      expect(isValidRadiusValue(formatRadius(v)), `${v} -> ${formatRadius(v)}`).toBe(true);
    }
  });

  it("formatLetterSpacing: every 0.005em step from -0.05 to 0.2 is a valid letter-spacing value", () => {
    for (let i = -10; i <= 40; i++) {
      const v = i * 0.005;
      expect(isValidLetterSpacingValue(formatLetterSpacing(v)), `${v} -> ${formatLetterSpacing(v)}`).toBe(true);
    }
  });

  it("formatRadius rounds away floating-point drift instead of producing a too-long string", () => {
    // 0.05 * 6 is the classic FP-drift example (0.30000000000000004).
    expect(formatRadius(0.05 * 6)).toBe("0.3rem");
  });
});
