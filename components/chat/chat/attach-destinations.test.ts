import { describe, expect, it } from "vitest";

import {
  ATTACH_DESTINATIONS,
  DEFAULT_ATTACH_DESTINATION,
  uploadPathQuery,
} from "./attach-destinations";

describe("uploadPathQuery", () => {
  it("builds a path query for every offered destination", () => {
    for (const d of ATTACH_DESTINATIONS) {
      expect(uploadPathQuery(d.path)).toBe(`?path=${encodeURIComponent(d.path)}`);
    }
  });

  it("falls back to the default for anything outside the fixed menu", () => {
    const fallback = `?path=${encodeURIComponent(DEFAULT_ATTACH_DESTINATION)}`;
    expect(uploadPathQuery("Random")).toBe(fallback);
    expect(uploadPathQuery("")).toBe(fallback);
    expect(uploadPathQuery("../../etc")).toBe(fallback);
    expect(uploadPathQuery("Images/../../secrets")).toBe(fallback);
    expect(uploadPathQuery("Uploads/../../../root")).toBe(fallback);
  });

  it("never emits a raw traversal segment even for a known-looking prefix", () => {
    // A value that merely STARTS with a real destination name must not slip
    // through — membership is exact-match against the fixed list.
    expect(uploadPathQuery("Uploads/../secrets")).not.toContain("..");
  });
});
