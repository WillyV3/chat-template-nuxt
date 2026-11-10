import { describe, it, expect } from "vitest";
import { deriveSwatch } from "./use-skin-draft";
import { THEMES } from "@/lib/theme/themes";

// deriveSwatch is the one piece of non-trivial (extracted, pure) logic in
// use-skin-draft.ts; the hook itself is thin state-shuffling, consistent with
// every other hook in this app (useThemeVars etc. have no colocated test).
describe("deriveSwatch", () => {
  it("returns [primary, accent, secondary, foreground] — the catalog's own swatch convention", () => {
    // Reverse-engineered from modern-minimal's hand-authored swatch, which is
    // EXACTLY its [primary, accent, secondary, foreground] light values.
    const modernMinimal = THEMES.find((t) => t.id === "modern-minimal")!;
    expect(deriveSwatch(modernMinimal.light)).toEqual(modernMinimal.swatch);
  });

  it("drops any of the 4 keys that are missing rather than inserting a hole", () => {
    expect(deriveSwatch({ primary: "#111111", foreground: "#222222" })).toEqual(["#111111", "#222222"]);
  });

  it("returns an empty array for a token map with none of the 4 keys", () => {
    expect(deriveSwatch({ background: "#fff" })).toEqual([]);
  });
});
