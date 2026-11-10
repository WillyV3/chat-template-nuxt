// Where "my skins" live. Sontara kept them in Postgres behind /api/skins with a
// moderation queue; here it is a small async interface so an app can swap in
// its own DB. Default: localStorage. Stored rows are RE-VALIDATED on read
// (resolveSkinTheme) — never trust that a stored payload is still valid.
import { generateSkinSlug, resolveSkinTheme, type SkinPayload, type SkinRow, type SkinTheme } from "./skins";

export interface SkinStore {
  list(): Promise<SkinRow[]>;
  /** Persist an already-validated payload; returns the stored row. */
  add(name: string, payload: SkinPayload): Promise<SkinRow>;
  remove(slug: string): Promise<void>;
}

export const SKIN_STORAGE_KEY = "theme-skins";

/** localStorage-backed store. `storage` is injectable for tests/SSR. */
export function createLocalSkinStore(storage: Pick<Storage, "getItem" | "setItem">): SkinStore {
  const read = (): SkinRow[] => {
    try {
      const parsed: unknown = JSON.parse(storage.getItem(SKIN_STORAGE_KEY) ?? "[]");
      return Array.isArray(parsed) ? (parsed as SkinRow[]) : [];
    } catch {
      return [];
    }
  };
  const write = (rows: SkinRow[]) => storage.setItem(SKIN_STORAGE_KEY, JSON.stringify(rows));
  return {
    async list() {
      return read();
    },
    async add(name, payload) {
      // ponytail: self-approved — no moderation queue for a user's own browser.
      const row: SkinRow = { slug: generateSkinSlug(name), name: name.trim(), payload, status: "approved" };
      write([row, ...read()]);
      return row;
    },
    async remove(slug) {
      write(read().filter((r) => r.slug !== slug));
    },
  };
}

/** Rows -> applicable themes, dropping any that no longer validate. */
export function skinThemes(rows: SkinRow[]): SkinTheme[] {
  return rows.map(resolveSkinTheme).filter((t): t is SkinTheme => t !== null);
}
