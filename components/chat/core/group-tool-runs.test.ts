import { describe, it, expect } from "vitest";

import {
  groupToolRuns,
  summarizeToolRun,
  toolFamily,
  toolGlyph,
  currentlyRunning,
  type GroupableRow,
} from "./group-tool-runs";

const tool = (id: string, toolName: string, toolStatus = "done"): GroupableRow => ({
  id,
  role: "tool",
  toolName,
  toolStatus,
});
const say = (id: string): GroupableRow => ({ id, role: "assistant" });
const ask = (id: string): GroupableRow => ({ id, role: "user" });

/** The predicate chat-transcript.tsx actually wires in is `isSpecialToolRow`
 *  from renderers.tsx — NOT imported here on purpose. renderers.tsx pulls
 *  thinking-orbs/motion/streamdown, and this suite runs under vitest's
 *  `environment: "node"` (no jsdom); importing a "use client" component tree
 *  into a pure-logic test risks the whole FILE throwing at collection, which
 *  prints as a false "0 failed" rather than a real one. A stub predicate
 *  exercises the same branch (`isFoldable` returning false breaks a run)
 *  without that risk. `isSpecialToolRow` itself has no separate test: it
 *  walks the exact `kindsFor`/`RENDERERS` table `TranscriptMessage`
 *  dispatches through, so tsc is the pin — a renamed/removed kind fails the
 *  build, not a silently-stale mirror. */
const notWebsite = (m: GroupableRow) => m.toolName !== "website";

describe("grouping tool runs", () => {
  it("folds a run of 2+ foldable tool rows into one item", () => {
    const items = groupToolRuns(
      [say("a"), tool("1", "gmail"), tool("2", "gmail"), tool("3", "google_sheets"), say("b")],
      notWebsite,
    );
    expect(items.map((i) => i.kind)).toEqual(["message", "tool-run", "message"]);
    const run = items[1];
    if (run.kind !== "tool-run") throw new Error("expected a run");
    expect(run.messages).toHaveLength(3);
  });

  it("leaves a single tool call alone — nothing to fold TO", () => {
    const items = groupToolRuns([tool("1", "gmail")], notWebsite);
    expect(items.map((i) => i.kind)).toEqual(["message"]);
  });

  it("folds exactly 2 — the stated minimum", () => {
    const items = groupToolRuns([tool("1", "gmail"), tool("2", "gmail")], notWebsite);
    expect(items.map((i) => i.kind)).toEqual(["tool-run"]);
  });

  it("a special card breaks a group instead of joining it", () => {
    const items = groupToolRuns(
      [tool("1", "gmail"), tool("2", "gmail"), tool("3", "website"), tool("4", "gmail"), tool("5", "gmail")],
      notWebsite,
    );
    expect(items.map((i) => i.kind)).toEqual(["tool-run", "message", "tool-run"]);
    expect((items[1] as { kind: "message"; message: GroupableRow }).message.toolName).toBe("website");
  });

  it("a lone special card between two foldable singles stays three separate rows", () => {
    // Below MIN_RUN on both sides — nothing to fold, and the special card in
    // the middle must still render as itself, not get swallowed.
    const items = groupToolRuns([tool("1", "gmail"), tool("2", "website"), tool("3", "gmail")], notWebsite);
    expect(items.map((i) => i.kind)).toEqual(["message", "message", "message"]);
  });

  it("an assistant message breaks a run — two bursts either side of an explanation stay two", () => {
    const items = groupToolRuns(
      [tool("1", "gmail"), tool("2", "gmail"), say("mid"), tool("3", "gmail"), tool("4", "gmail")],
      notWebsite,
    );
    expect(items.map((i) => i.kind)).toEqual(["tool-run", "message", "tool-run"]);
  });

  it("a user message breaks a run — one agent reply's steps don't merge with the next", () => {
    const items = groupToolRuns(
      [tool("1", "gmail"), tool("2", "gmail"), ask("mid"), tool("3", "gmail"), tool("4", "gmail")],
      notWebsite,
    );
    expect(items.map((i) => i.kind)).toEqual(["tool-run", "message", "tool-run"]);
  });

  it("a run that is STILL RUNNING folds too, once it reaches the minimum", () => {
    const items = groupToolRuns(
      [tool("1", "gmail"), tool("2", "google_sheets", "running")],
      notWebsite,
    );
    expect(items.map((i) => i.kind)).toEqual(["tool-run"]);
  });

  it("a solitary running tool stays its own row — nothing to fold yet", () => {
    const items = groupToolRuns([say("a"), tool("1", "gmail", "running")], notWebsite);
    expect(items.map((i) => i.kind)).toEqual(["message", "message"]);
  });

  it("keeps every message, in order, whatever the shape", () => {
    const input = [say("a"), tool("1", "gmail"), tool("2", "google_sheets"), ask("b")];
    const flat = groupToolRuns(input, notWebsite).flatMap((i) =>
      i.kind === "message" ? [i.message] : i.messages,
    );
    expect(flat.map((m) => m.id)).toEqual(["a", "1", "2", "b"]);
  });

  it("history-shaped and live-shaped inputs give the same groups for the same finished turn", () => {
    // Live: the run arrives one call at a time, each transiently "running"
    // before tool/resolved flips it. History: chat.history only ever holds
    // FINISHED tools (lib/chat/history.ts), so every row is "done" from the
    // start. Same final shape once the turn is over — grouping must agree.
    const live = [
      say("a"),
      tool("1", "gmail", "done"),
      tool("2", "gmail", "done"),
      tool("3", "google_sheets", "done"),
      say("b"),
    ];
    const history = [
      { id: "h-a", role: "assistant" as const },
      { id: "h-1", role: "tool" as const, toolName: "gmail", toolStatus: "done" },
      { id: "h-2", role: "tool" as const, toolName: "gmail", toolStatus: "done" },
      { id: "h-3", role: "tool" as const, toolName: "google_sheets", toolStatus: "done" },
      { id: "h-b", role: "assistant" as const },
    ];
    const liveItems = groupToolRuns(live, notWebsite);
    const historyItems = groupToolRuns(history, notWebsite);
    expect(historyItems.map((i) => i.kind)).toEqual(liveItems.map((i) => i.kind));
    expect(historyItems.map((i) => (i.kind === "tool-run" ? i.messages.length : 1))).toEqual(
      liveItems.map((i) => (i.kind === "tool-run" ? i.messages.length : 1)),
    );
  });
});

describe("toolFamily", () => {
  it.each([
    ["gmail", "email"],
    ["gmail_search_to_file", "email"],
    ["google_calendar", "calendar"],
    ["google_sheets", "sheets"],
    ["google_slides", "slides"],
    ["google_docs", "docs"],
    ["google_drive", "drive"],
    ["google_workspace", "workspace"],
    ["document_create", "docs"],
    ["file_read", "files"],
    ["file_write", "files"],
    ["file_edit", "files"],
    ["list_files", "files"],
    ["artifact_read", "files"],
    ["memory_recall", "memory"],
    ["shell", "code"],
    ["python_repl", "code"],
    ["web_search", "web"],
    ["browser_open", "web"],
    ["image_generate", "images"],
    ["website", "website"],
    ["circle_draft", "circle"],
    ["ask_agent", "circle"],
    ["github", "github"],
  ])("%s -> %s", (name, expected) => {
    expect(toolFamily(name)).toBe(expected);
  });

  it("namespaces an MCP tool by its server, not a generic label", () => {
    expect(toolFamily("mcp_zapier__send_email")).toBe("zapier");
    expect(toolFamily("mcp_github__create_issue")).toBe("github");
  });

  it("falls back to 'tools' for anything unmapped, including no name at all", () => {
    expect(toolFamily("frobnicate")).toBe("tools");
    expect(toolFamily(undefined)).toBe("tools");
  });
});

describe("currentlyRunning", () => {
  it("is undefined when nothing in the run is running", () => {
    expect(currentlyRunning([tool("1", "gmail"), tool("2", "gmail")])).toBeUndefined();
  });

  it("finds the one running row wherever it sits — resolution order isn't call order", () => {
    // DECISIONS 2026-09-22: the loop can fire tool calls in parallel, so an
    // earlier call can still be "running" after a later one resolved.
    const rows = [tool("1", "web_read", "running"), tool("2", "web_read", "done")];
    expect(currentlyRunning(rows)?.id).toBe("1");
  });

  it("with two rows running at once, picks the one LAST in call order", () => {
    const rows = [tool("1", "web_read", "running"), tool("2", "file_write", "running")];
    expect(currentlyRunning(rows)?.id).toBe("2");
  });
});

describe("summarizeToolRun", () => {
  it("says what happened, singular and plural", () => {
    expect(summarizeToolRun([tool("1", "gmail")])).toBe("Worked through 1 step · email");
    expect(summarizeToolRun([tool("1", "gmail"), tool("2", "gmail")])).toBe(
      "Worked through 2 steps · email",
    );
  });

  it("lists each distinct family once, in first-appearance order", () => {
    const rows = [
      tool("1", "gmail"),
      tool("2", "google_sheets"),
      tool("3", "gmail"),
      tool("4", "file_write"),
    ];
    expect(summarizeToolRun(rows)).toBe("Worked through 4 steps · email, sheets, files");
  });

  it("caps the family list and sums the rest, rather than stuffing the line", () => {
    const rows = ["gmail", "google_sheets", "file_write", "shell", "web_search"].map((n, i) =>
      tool(String(i), n),
    );
    expect(summarizeToolRun(rows)).toBe(
      "Worked through 5 steps · email, sheets, files, code +1 more",
    );
  });

  it("appends a failure count", () => {
    const rows = [tool("1", "gmail"), tool("2", "gmail", "error")];
    expect(summarizeToolRun(rows)).toBe("Worked through 2 steps · email · 1 failed");
  });

  it("while running: present tense, current family only, no retrospective list", () => {
    const rows = [tool("1", "gmail"), tool("2", "google_sheets", "running")];
    expect(summarizeToolRun(rows)).toBe("Working through 2 steps · sheets");
  });
});

describe("toolGlyph", () => {
  it("exact names beat prefixes, prefixes beat the wrench", () => {
    expect(toolGlyph("shell")).toBe("terminal");
    expect(toolGlyph("file_read")).toBe("file-read");
    expect(toolGlyph("file_edit")).toBe("file-write");
    expect(toolGlyph("memory_recall")).toBe("search");
    expect(toolGlyph("memory_consolidate")).toBe("database");
    expect(toolGlyph("mcp_zapier__send")).toBe("plug");
    expect(toolGlyph("python_exec")).toBe("terminal");
    expect(toolGlyph("gmail")).toBe("wrench");
  });
});

describe("custom tool tables (a host with its own tool names)", () => {
  const rules = [
    ["case_", "cases"],
    ["case_search", "search"],
    ["gmail", "mail-override"],
  ] as const;

  it("toolFamily uses the host's rules, longest prefix first", () => {
    expect(toolFamily("case_open", { familyRules: rules })).toBe("cases");
    expect(toolFamily("case_search_text", { familyRules: rules })).toBe("search");
    // Sontara's table is replaced, not merged: "file_write" is unknown here.
    expect(toolFamily("file_write", { familyRules: rules })).toBe("tools");
    expect(toolFamily("gmail", { familyRules: rules })).toBe("mail-override");
  });

  it("an empty rule list labels everything 'tools'; mcp_ stays the server name", () => {
    expect(toolFamily("gmail", { familyRules: [] })).toBe("tools");
    expect(toolFamily("mcp_zapier__send", { familyRules: [] })).toBe("zapier");
  });

  it("omitted tables behave exactly like today's defaults", () => {
    expect(toolFamily("gmail", {})).toBe(toolFamily("gmail"));
    expect(toolFamily("gmail", {})).toBe("email");
    const rows = [tool("1", "gmail"), tool("2", "file_write")];
    expect(summarizeToolRun(rows, {})).toBe(summarizeToolRun(rows));
  });

  it("summarizeToolRun labels with the host's rules, done and running", () => {
    const done = [tool("1", "case_open"), tool("2", "case_search_text")];
    expect(summarizeToolRun(done, { familyRules: rules })).toBe(
      "Worked through 2 steps · cases, search",
    );
    const live = [tool("1", "case_open"), tool("2", "case_search_text", "running")];
    expect(summarizeToolRun(live, { familyRules: rules })).toBe(
      "Working through 2 steps · search",
    );
  });

  it("toolGlyph uses the host's exact table and fallback", () => {
    const exact = { case_open: "file-read" } as const;
    expect(toolGlyph("case_open", { exact })).toBe("file-read");
    // Sontara's exact table is replaced: shell is no longer a terminal...
    expect(toolGlyph("shell", { exact, fallback: () => "wrench" })).toBe("wrench");
    // ...and the fallback is the host's, not Sontara's prefix families.
    expect(toolGlyph("memory_store", { exact, fallback: () => "globe" })).toBe("globe");
    // Default fallback still applies when only `exact` is given.
    expect(toolGlyph("memory_store", { exact })).toBe("database");
    // Names that exist on Object.prototype are not table hits.
    expect(toolGlyph("constructor")).toBe("wrench");
  });
});
