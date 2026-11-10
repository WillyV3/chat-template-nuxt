import { describe, expect, it } from "vitest";

import { EMPTY_COMPOSER, composerReducer } from "./composer-state";

describe("composer state", () => {
  it("setInput replaces the draft (RoomApi.setInput / RoomApi.input)", () => {
    const s = composerReducer(EMPTY_COMPOSER, { type: "input/set", text: "fill me" });
    expect(s.input).toBe("fill me");
    expect(composerReducer(s, { type: "input/set", text: "" }).input).toBe("");
  });

  it("attach adds a pill from outside the picker, and the same path twice is a no-op", () => {
    const pill = { id: "a", label: "plan.pdf", path: "Reports/plan.pdf", note: "[n]" };
    const once = composerReducer(EMPTY_COMPOSER, { type: "pill/attached", pill });
    expect(once.pills).toEqual([pill]);
    const twice = composerReducer(once, { type: "pill/attached", pill: { ...pill, id: "b" } });
    expect(twice).toBe(once);
    // A pill with no path can't be deduped, so both land.
    const bare = composerReducer(once, { type: "pill/attached", pill: { id: "c", label: "x" } });
    expect(bare.pills).toHaveLength(2);
  });

  it("an upload pill is patched in place when it finishes, and dropped when it fails", () => {
    const added = composerReducer(EMPTY_COMPOSER, {
      type: "pill/added",
      pill: { id: "u", label: "big.csv", uploading: true },
    });
    const done = composerReducer(added, {
      type: "pill/patched",
      id: "u",
      patch: { uploading: false, uploaded: "big.csv" },
    });
    expect(done.pills[0]).toMatchObject({ uploading: false, uploaded: "big.csv" });
    expect(composerReducer(done, { type: "pill/removed", id: "u" }).pills).toEqual([]);
  });

  it("sent clears the draft, the images and the pills together", () => {
    let s = composerReducer(EMPTY_COMPOSER, { type: "input/set", text: "hi" });
    s = composerReducer(s, { type: "pill/added", pill: { id: "p", label: "f" } });
    s = composerReducer(s, {
      type: "image/added",
      image: { id: "i", mimeType: "image/png", content: "", preview: "", name: "i.png" },
    });
    expect(composerReducer(s, { type: "sent" })).toEqual(EMPTY_COMPOSER);
  });
});
