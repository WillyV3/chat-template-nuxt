import { describe, expect, it } from "vitest";

import {
  applyOp,
  applyOps,
  basename,
  breadcrumbs,
  buildTreeIndex,
  clearDeleting,
  fileId,
  folderId,
  isDeleting,
  join,
  markDeleting,
  migrateIds,
  nodeDir,
  parentOf,
  pruneDeleting,
  ROOT_ID,
  splitName,
  type DirFile,
  type FilesSnapshot,
} from "./model";

const file = (path: string, name: string, size = 10): DirFile => ({
  name,
  path,
  size,
  mime_type: "text/plain",
  source: "shared",
});

// A realistic files.list payload: root files, nested files, an empty folder,
// and a folder that exists ONLY implicitly through a file's path.
const snap: FilesSnapshot = {
  files: [
    file("", "readme.md"),
    file("", "budget.csv"),
    file("Reports", "q2.pdf"),
    file("Reports/Q2", "detail.xlsx"),
    file("Implicit/Deep", "hidden.txt"),
  ],
  folders: ["Reports", "Reports/Q2", "Empty"],
};

describe("path helpers", () => {
  it("join/parentOf/basename round-trip", () => {
    expect(join("", "Reports")).toBe("Reports");
    expect(join("Reports", "Q2")).toBe("Reports/Q2");
    expect(parentOf("Reports/Q2")).toBe("Reports");
    expect(parentOf("Reports")).toBe("");
    expect(basename("Reports/Q2")).toBe("Q2");
    expect(basename("Reports")).toBe("Reports");
  });

  it("breadcrumbs builds cumulative paths", () => {
    expect(breadcrumbs("")).toEqual([]);
    expect(breadcrumbs("a/b/c")).toEqual([
      { label: "a", path: "a" },
      { label: "b", path: "a/b" },
      { label: "c", path: "a/b/c" },
    ]);
  });

  it("splitName handles dotfiles and no-extension names", () => {
    expect(splitName("report.pdf")).toEqual({ base: "report", ext: "pdf" });
    expect(splitName("Makefile")).toEqual({ base: "Makefile", ext: "" });
    expect(splitName("archive.tar.gz")).toEqual({ base: "archive.tar", ext: "gz" });
  });
});

describe("buildTreeIndex", () => {
  const index = buildTreeIndex(snap);

  it("root children are folders-first, alphabetical", () => {
    expect(index.children.get(ROOT_ID)).toEqual([
      folderId("Empty"),
      folderId("Implicit"),
      folderId("Reports"),
      fileId("budget.csv"),
      fileId("readme.md"),
    ]);
  });

  it("materializes implicit folders from file paths", () => {
    expect(index.nodes.get(folderId("Implicit"))?.kind).toBe("folder");
    expect(index.children.get(folderId("Implicit"))).toEqual([
      folderId("Implicit/Deep"),
    ]);
    expect(index.children.get(folderId("Implicit/Deep"))).toEqual([
      fileId("Implicit/Deep/hidden.txt"),
    ]);
  });

  it("keeps empty folders and nests subfolders under parents", () => {
    expect(index.children.get(folderId("Empty"))).toBeUndefined();
    expect(index.children.get(folderId("Reports"))).toEqual([
      folderId("Reports/Q2"),
      fileId("Reports/q2.pdf"),
    ]);
  });

  it("file nodes carry the full DirFile for the viewer", () => {
    const node = index.nodes.get(fileId("Reports/Q2/detail.xlsx"));
    expect(node?.kind).toBe("file");
    if (node?.kind === "file") expect(node.file.name).toBe("detail.xlsx");
  });

  it("nodeDir targets the folder itself or a file's parent", () => {
    expect(nodeDir(index.nodes.get(folderId("Reports"))!)).toBe("Reports");
    expect(nodeDir(index.nodes.get(fileId("Reports/q2.pdf"))!)).toBe("Reports");
    expect(nodeDir(index.nodes.get(ROOT_ID)!)).toBe("");
  });
});

describe("applyOp", () => {
  it("delete file removes exactly that file", () => {
    const out = applyOp(snap, { type: "delete", path: "Reports/q2.pdf", kind: "file" });
    expect(out.files.map((f) => f.name)).not.toContain("q2.pdf");
    expect(out.files).toHaveLength(4);
    expect(out.folders).toEqual(snap.folders);
  });

  it("delete folder removes its whole subtree", () => {
    const out = applyOp(snap, { type: "delete", path: "Reports", kind: "folder" });
    expect(out.folders).toEqual(["Empty"]);
    expect(out.files.map((f) => f.name).sort()).toEqual([
      "budget.csv",
      "hidden.txt",
      "readme.md",
    ]);
  });

  it("delete folder does not swallow same-prefix siblings", () => {
    const withSibling: FilesSnapshot = {
      files: [file("Rep", "keep.txt")],
      folders: ["Rep", "Reports"],
    };
    const out = applyOp(withSibling, { type: "delete", path: "Rep", kind: "folder" });
    expect(out.folders).toEqual(["Reports"]);
  });

  it("move file rewrites path and name", () => {
    const out = applyOp(snap, {
      type: "move",
      from: "readme.md",
      to: "Reports/Q2/readme-final.md",
      kind: "file",
    });
    const moved = out.files.find((f) => f.name === "readme-final.md");
    expect(moved?.path).toBe("Reports/Q2");
    expect(out.files.find((f) => f.name === "readme.md")).toBeUndefined();
  });

  it("move folder rewrites descendants and keeps empty destination explicit", () => {
    const out = applyOp(snap, {
      type: "move",
      from: "Reports",
      to: "Archive",
      kind: "folder",
    });
    expect(out.folders.sort()).toEqual(["Archive", "Archive/Q2", "Empty"]);
    expect(out.files.find((f) => f.name === "q2.pdf")?.path).toBe("Archive");
    expect(out.files.find((f) => f.name === "detail.xlsx")?.path).toBe("Archive/Q2");
  });

  it("move of an implicit folder adds the destination to folders", () => {
    const out = applyOp(snap, {
      type: "move",
      from: "Implicit",
      to: "Explicit",
      kind: "folder",
    });
    expect(out.folders).toContain("Explicit");
    expect(out.files.find((f) => f.name === "hidden.txt")?.path).toBe("Explicit/Deep");
  });

  it("create-folder is idempotent", () => {
    const once = applyOp(snap, { type: "create-folder", path: "New" });
    const twice = applyOp(once, { type: "create-folder", path: "New" });
    expect(twice.folders.filter((d) => d === "New")).toHaveLength(1);
  });
});

describe("applyOps (optimistic queue reconcile)", () => {
  it("applies ops in order over the server snapshot", () => {
    const out = applyOps(snap, [
      { type: "create-folder", path: "Inbox" },
      { type: "move", from: "readme.md", to: "Inbox/readme.md", kind: "file" },
      { type: "delete", path: "Empty", kind: "folder" },
    ]);
    expect(out.folders).toContain("Inbox");
    expect(out.folders).not.toContain("Empty");
    expect(out.files.find((f) => f.name === "readme.md")?.path).toBe("Inbox");
  });

  it("a rolled-back (removed) op leaves no trace", () => {
    const withOp = applyOps(snap, [
      { type: "delete", path: "budget.csv", kind: "file" },
    ]);
    expect(withOp.files).toHaveLength(4);
    const rolledBack = applyOps(snap, []);
    expect(rolledBack).toEqual(snap);
  });
});

describe("deleting-set transitions (background folder deletes)", () => {
  it("marking a folder deleting leaves the snapshot untouched — the row stays", () => {
    const deleting = markDeleting(new Set(), "Reports");
    expect(deleting.has("Reports")).toBe(true);
    // No op is enqueued for a folder delete, so the derived view still
    // contains the folder and its subtree — only presentation changes.
    const index = buildTreeIndex(snap);
    expect(index.nodes.has(folderId("Reports"))).toBe(true);
    expect(index.nodes.has(fileId("Reports/q2.pdf"))).toBe(true);
  });

  it("done clears exactly that mark", () => {
    let deleting = markDeleting(new Set(), "Reports");
    deleting = markDeleting(deleting, "Empty");
    deleting = clearDeleting(deleting, "Reports");
    expect([...deleting]).toEqual(["Empty"]);
  });

  it("done with residual keeps the row: mark cleared, snapshot untouched", () => {
    let deleting = markDeleting(new Set(), "Reports");
    deleting = clearDeleting(deleting, "Reports"); // residual > 0 clears too
    expect(deleting.size).toBe(0);
    const index = buildTreeIndex(snap);
    expect(index.nodes.has(folderId("Reports"))).toBe(true);
  });

  it("isDeleting covers the folder and its subtree, not same-prefix siblings", () => {
    const deleting = markDeleting(new Set(), "Rep");
    expect(isDeleting(deleting, "Rep")).toBe(true);
    expect(isDeleting(deleting, "Rep/inner.txt")).toBe(true);
    expect(isDeleting(deleting, "Reports")).toBe(false);
    expect(isDeleting(new Set(), "Rep")).toBe(false);
  });

  it("pruneDeleting drops marks for folders gone from the snapshot", () => {
    let deleting = markDeleting(new Set(), "Reports"); // in snap.folders
    deleting = markDeleting(deleting, "Implicit"); // exists only via file paths
    deleting = markDeleting(deleting, "Vanished"); // done event was missed
    const pruned = pruneDeleting(deleting, snap);
    expect([...pruned].sort()).toEqual(["Implicit", "Reports"]);
  });
});

describe("migrateIds", () => {
  it("folder rename migrates the folder, its descendants, and contained files", () => {
    const ids = [
      ROOT_ID,
      folderId("Reports"),
      folderId("Reports/Q2"),
      fileId("Reports/Q2/detail.xlsx"),
      folderId("Empty"),
    ];
    expect(
      migrateIds(ids, { type: "move", from: "Reports", to: "Archive", kind: "folder" })
    ).toEqual([
      ROOT_ID,
      folderId("Archive"),
      folderId("Archive/Q2"),
      fileId("Archive/Q2/detail.xlsx"),
      folderId("Empty"),
    ]);
  });

  it("file rename migrates only that file id", () => {
    const ids = [fileId("readme.md"), fileId("budget.csv")];
    expect(
      migrateIds(ids, { type: "move", from: "readme.md", to: "notes.md", kind: "file" })
    ).toEqual([fileId("notes.md"), fileId("budget.csv")]);
  });

  it("non-move ops change nothing", () => {
    const ids = [folderId("Reports")];
    expect(migrateIds(ids, { type: "delete", path: "Reports", kind: "folder" })).toEqual(ids);
  });
});
