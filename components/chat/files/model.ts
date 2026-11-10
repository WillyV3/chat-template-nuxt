// Pure data model for the Files tab. No React, no DOM — everything here is
// unit-testable in node. The tree COMPONENT (browser.tsx) owns interaction via
// headless-tree; this module owns the mapping from the gateway's `files.list`
// payload to tree items, and the optimistic-mutation algebra over it.

// ─── Entry types ────────────────────────────────────────────────────────────

export type FileEntry = {
  name: string;
  size: number;
  mime_type: string;
  source?: "shared" | "uploads";
  /** Parent directory relative to the file root ("" = root). */
  path?: string;
};

// `files.list` returns each file with a `path` = its parent directory relative
// to the root ("" = root); `folders` lists every folder path (empties included).
export type DirFile = FileEntry & { path: string };

export type FilesSnapshot = {
  files: DirFile[];
  folders: string[];
};

export const EMPTY_SNAPSHOT: FilesSnapshot = { files: [], folders: [] };

// ─── Path helpers ───────────────────────────────────────────────────────────

/** join("Reports", "Q2") => "Reports/Q2"; join("", "Reports") => "Reports" */
export function join(dir: string, name: string): string {
  return dir ? `${dir}/${name}` : name;
}

/** parentOf("Reports/Q2") => "Reports"; parentOf("Reports") => "" */
export function parentOf(path: string): string {
  const i = path.lastIndexOf("/");
  return i >= 0 ? path.slice(0, i) : "";
}

/** basename("Reports/Q2") => "Q2"; basename("Reports") => "Reports" */
export function basename(path: string): string {
  const i = path.lastIndexOf("/");
  return i >= 0 ? path.slice(i + 1) : path;
}

/** Build breadcrumb segments for a relative path. */
export function breadcrumbs(path: string): { label: string; path: string }[] {
  if (!path) return [];
  const parts = path.split("/");
  const out: { label: string; path: string }[] = [];
  let acc = "";
  for (const p of parts) {
    acc = acc ? `${acc}/${p}` : p;
    out.push({ label: p, path: acc });
  }
  return out;
}

// ─── File-name helpers ──────────────────────────────────────────────────────

export function getExtension(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

export function splitName(name: string): { base: string; ext: string } {
  const ext = getExtension(name);
  const base = ext ? name.slice(0, name.length - ext.length - 1) : name;
  return { base, ext };
}

export function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

// ─── Tree item ids ──────────────────────────────────────────────────────────
// headless-tree addresses items by string id. Ids are prefixed rel-paths so a
// file and folder can never collide, and lookups stay O(1) string ops.

export const ROOT_ID = "<root>";

export function folderId(path: string): string {
  return path === "" ? ROOT_ID : `d:${path}`;
}

export function fileId(fullPath: string): string {
  return `f:${fullPath}`;
}

export type TreeNode =
  | { kind: "folder"; path: string; name: string }
  | { kind: "file"; path: string; file: DirFile }; // path = full path incl. name

/** The folder an action on this node targets: the folder itself, or a file's parent. */
export function nodeDir(node: TreeNode): string {
  return node.kind === "folder" ? node.path : parentOf(node.path);
}

export type TreeIndex = {
  nodes: Map<string, TreeNode>;
  /** children ids per folder id — folders first, each alphabetical. */
  children: Map<string, string[]>;
};

/**
 * Build the headless-tree data maps from a files.list snapshot. Folders the
 * backend didn't list but that appear in file paths are materialized, so a
 * stale/partial `folders` array can never orphan a file.
 */
export function buildTreeIndex(snap: FilesSnapshot): TreeIndex {
  const folderPaths = new Set<string>();
  const addWithParents = (p: string) => {
    while (p && !folderPaths.has(p)) {
      folderPaths.add(p);
      p = parentOf(p);
    }
  };
  for (const d of snap.folders) addWithParents(d);
  for (const f of snap.files) addWithParents(f.path);

  const nodes = new Map<string, TreeNode>();
  const childFolders = new Map<string, string[]>();
  const childFiles = new Map<string, string[]>();
  nodes.set(ROOT_ID, { kind: "folder", path: "", name: "Files" });

  for (const p of folderPaths) {
    nodes.set(folderId(p), { kind: "folder", path: p, name: basename(p) });
    const parent = folderId(parentOf(p));
    childFolders.set(parent, [...(childFolders.get(parent) ?? []), folderId(p)]);
  }
  for (const f of snap.files) {
    const id = fileId(join(f.path, f.name));
    if (nodes.has(id)) continue; // defensive: duplicate rows in payload
    nodes.set(id, { kind: "file", path: join(f.path, f.name), file: f });
    const parent = folderId(f.path);
    childFiles.set(parent, [...(childFiles.get(parent) ?? []), id]);
  }

  const byName = (a: string, b: string) => {
    const na = nodes.get(a);
    const nb = nodes.get(b);
    const la = na?.kind === "folder" ? na.name : (na?.file.name ?? "");
    const lb = nb?.kind === "folder" ? nb.name : (nb?.file.name ?? "");
    return la.localeCompare(lb);
  };

  const children = new Map<string, string[]>();
  for (const parent of new Set([...childFolders.keys(), ...childFiles.keys()])) {
    children.set(parent, [
      ...(childFolders.get(parent) ?? []).sort(byName),
      ...(childFiles.get(parent) ?? []).sort(byName),
    ]);
  }
  return { nodes, children };
}

// ─── Optimistic mutation algebra ────────────────────────────────────────────
// The UI applies ops to the last server snapshot the moment the user acts;
// the RPC runs behind it. A failed op is removed (rollback); a settled op is
// kept applied until the next files.list reload confirms it.

export type FilesOp =
  | { type: "delete"; path: string; kind: "file" | "folder" }
  | { type: "move"; from: string; to: string; kind: "file" | "folder" }
  | { type: "create-folder"; path: string };

export function applyOp(snap: FilesSnapshot, op: FilesOp): FilesSnapshot {
  switch (op.type) {
    case "create-folder":
      return snap.folders.includes(op.path)
        ? snap
        : { ...snap, folders: [...snap.folders, op.path] };
    case "delete": {
      if (op.kind === "file") {
        const dir = parentOf(op.path);
        const name = basename(op.path);
        return {
          ...snap,
          files: snap.files.filter((f) => !(f.path === dir && f.name === name)),
        };
      }
      const inside = (p: string) => p === op.path || p.startsWith(`${op.path}/`);
      return {
        files: snap.files.filter((f) => !inside(f.path)),
        folders: snap.folders.filter((d) => !inside(d)),
      };
    }
    case "move": {
      if (op.kind === "file") {
        const dir = parentOf(op.from);
        const name = basename(op.from);
        return {
          ...snap,
          files: snap.files.map((f) =>
            f.path === dir && f.name === name
              ? { ...f, path: parentOf(op.to), name: basename(op.to) }
              : f
          ),
        };
      }
      const rewrite = (p: string) =>
        p === op.from
          ? op.to
          : p.startsWith(`${op.from}/`)
            ? op.to + p.slice(op.from.length)
            : p;
      const folders = snap.folders.map(rewrite);
      return {
        files: snap.files.map((f) =>
          rewrite(f.path) === f.path ? f : { ...f, path: rewrite(f.path) }
        ),
        // The moved folder may only exist implicitly (via its files) — make the
        // destination explicit so an empty folder survives the move.
        folders: folders.includes(op.to) ? folders : [...folders, op.to],
      };
    }
  }
}

export function applyOps(snap: FilesSnapshot, ops: FilesOp[]): FilesSnapshot {
  return ops.reduce(applyOp, snap);
}

// ─── Deleting state (background folder deletes) ─────────────────────────────
// Folder deletes are NOT optimistic: the gateway answers `files.delete` with
// { accepted: true, kind: "folder", files: N } and a background task drains
// the tree. The row STAYS, marked deleting, while children vanish through the
// normal files.changed reloads; `files.delete.done` { path, ok, residual }
// clears the mark. residual > 0 means the task gave up with files left — the
// mark clears but the row keeps rendering from the (unchanged) snapshot, so
// nothing silently half-vanishes. Files keep the optimistic remove.

/** Payload of the gateway's `files.delete.done` WS event. */
export type FilesDeleteDone = { path: string; ok: boolean; residual: number };

export function markDeleting(
  deleting: ReadonlySet<string>,
  path: string
): Set<string> {
  const next = new Set(deleting);
  next.add(path);
  return next;
}

export function clearDeleting(
  deleting: ReadonlySet<string>,
  path: string
): Set<string> {
  const next = new Set(deleting);
  next.delete(path);
  return next;
}

/** Whether `path` is a deleting folder or inside one (row dims + spins). */
export function isDeleting(
  deleting: ReadonlySet<string>,
  path: string
): boolean {
  for (const d of deleting) {
    if (path === d || path.startsWith(`${d}/`)) return true;
  }
  return false;
}

/**
 * Drop marks whose folder no longer exists in a fresh server snapshot. Covers
 * a `files.delete.done` missed across a WS reconnect — without this a spinner
 * could stick forever on a folder the gateway already finished deleting.
 */
export function pruneDeleting(
  deleting: ReadonlySet<string>,
  snap: FilesSnapshot
): Set<string> {
  const next = new Set<string>();
  for (const d of deleting) {
    const alive =
      snap.folders.some((f) => f === d || f.startsWith(`${d}/`)) ||
      snap.files.some((f) => f.path === d || f.path.startsWith(`${d}/`));
    if (alive) next.add(d);
  }
  return next;
}

/**
 * Rewrite tree-state ids (expanded/selected/focused) after a folder move so an
 * expanded folder stays expanded across its own rename. File moves change only
 * the file's own id — same rewrite covers it.
 */
export function migrateIds(ids: string[], op: FilesOp): string[] {
  if (op.type !== "move") return ids;
  const rewritePath = (p: string) =>
    p === op.from
      ? op.to
      : op.kind === "folder" && p.startsWith(`${op.from}/`)
        ? op.to + p.slice(op.from.length)
        : p;
  return ids.map((id) => {
    if (id === ROOT_ID) return id;
    const prefix = id.slice(0, 2);
    if (prefix !== "d:" && prefix !== "f:") return id;
    return prefix + rewritePath(id.slice(2));
  });
}
