import { describe, it, expect } from "vitest";
import { createLocalSkinStore, skinThemes, SKIN_STORAGE_KEY } from "./skin-store";
import { themeToSkinPayloadDraft } from "./skin-submit";
import { validateSkinPayload, isSkinSlug } from "./skins";
import { themeById } from "./themes";

function fakeStorage() {
  const m = new Map<string, string>();
  return {
    m,
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
  };
}
const payload = () => {
  const r = validateSkinPayload(themeToSkinPayloadDraft(themeById("default"), "Mine"));
  if (!r.ok) throw new Error(r.errors.join());
  return r.data;
};

describe("localStorage skin store", () => {
  it("add -> list -> remove", async () => {
    const s = fakeStorage();
    const store = createLocalSkinStore(s);
    expect(await store.list()).toEqual([]);
    const row = await store.add("  Mine  ", payload());
    expect(isSkinSlug(row.slug)).toBe(true);
    expect(row.name).toBe("Mine");
    expect((await store.list()).map((r) => r.slug)).toEqual([row.slug]);
    expect(s.m.has(SKIN_STORAGE_KEY)).toBe(true);
    // a second store over the same storage sees it (persistence, not memory)
    expect(await createLocalSkinStore(s).list()).toHaveLength(1);
    await store.remove(row.slug);
    expect(await store.list()).toEqual([]);
  });

  it("corrupt storage reads as empty", async () => {
    const s = fakeStorage();
    s.setItem(SKIN_STORAGE_KEY, "{not json");
    expect(await createLocalSkinStore(s).list()).toEqual([]);
    s.setItem(SKIN_STORAGE_KEY, '{"a":1}');
    expect(await createLocalSkinStore(s).list()).toEqual([]);
  });

  it("skinThemes resolves valid rows and drops tampered ones", async () => {
    const store = createLocalSkinStore(fakeStorage());
    const good = await store.add("Good", payload());
    const bad = { ...good, slug: "skin-bad-000000", payload: { ...good.payload, light: { ...good.payload.light, primary: "url(evil)" } } };
    const themes = skinThemes([good, bad]);
    expect(themes.map((t) => t.id)).toEqual([good.slug]);
  });
});
