// Collapse a FLOOD of tool rows into one line.
//
// A customer asked one question and the agent made 56 tool calls before it
// answered (report 909f821e, 2026-10-01) — the chat rendered 56 rows between
// the question and the reply, every one its own collapsed-by-default card.
// That's "head stuffing": distracting, and it buries the one row the user
// might actually want (a failure, a search result) in a wall of identical
// rows. The individual calls still matter when something breaks, so folding
// hides them behind one expandable summary rather than dropping them.
//
// GENERAL ON PURPOSE (2026-10-01 rewrite). This used to fold only a curated
// allowlist of file tools (site-build churn) at 3+ in a row, and never while
// one was still running. The customer's 56 calls were Gmail, not file writes
// — an allowlist is the wrong shape for "any tool can flood". Folding is now
// driven by `isFoldable`, supplied by the caller: a tool row folds unless it
// has a dedicated card the user is meant to see (website, a successful
// image_generate) — packages/chat chat-transcript.tsx wires that in from the SAME renderer
// registry TranscriptMessage dispatches through (renderers.tsx
// isSpecialToolRow), so "is this special" can't drift between what renders
// and what folds. The function stays generic/injectable so it's testable
// without importing React at all.
//
// A run that is still RUNNING now CAN be part of a group — the old rule was
// "never fold a running row, hiding live progress is the opposite of
// reassurance", but the live reassurance now lives ON the folded line itself
// (ticking step count + the current tool's family), so folding no longer
// costs the user that signal. A solitary running tool (nothing to fold yet)
// still renders as its own row.
//
// Lives in @sontara/core (moved from apps/web/lib/chat 2026-10-29): web keeps
// a shim at that path, mobile imports the subpath. One table decides what
// folds, what the folded line says and which glyph a tool wears — on both
// faces.

/** The minimum a row needs for grouping — structural, so this stays testable
 *  without the full ChatMessage. Only "tool" is ever inspected; a face may
 *  carry other roles (mobile has "hitl"). */
export interface GroupableRow {
  id: string;
  role: string;
  toolName?: string;
  toolStatus?: string;
}

/**
 * A run shorter than this is not a flood. One tool call has nowhere to fold
 * TO (there's nothing hidden by collapsing a single row) — two or more reads
 * as a burst the user doesn't need to watch one row at a time.
 */
const MIN_RUN = 2;

export type TranscriptItem<T> =
  | { kind: "message"; message: T }
  | { kind: "tool-run"; id: string; messages: T[] };

/**
 * Fold consecutive foldable tool rows into `tool-run` items, leaving every
 * other message untouched and IN ORDER.
 *
 * A run is broken by anything that isn't a foldable tool row: the agent's own
 * text, the user's next message, or a tool row the caller's `isFoldable` says
 * has a card of its own. That's what makes the grouping track one agent
 * reply's actual steps rather than merging two unrelated bursts.
 *
 * @param isFoldable Decides whether a single tool ROW belongs in a run (the
 *   caller already knows it's role "tool" — this is only asked about rows
 *   that are).
 */
export function groupToolRuns<T extends GroupableRow>(
  messages: T[],
  isFoldable: (message: T) => boolean,
): TranscriptItem<T>[] {
  const items: TranscriptItem<T>[] = [];
  let run: T[] = [];

  const flush = () => {
    if (run.length === 0) return;
    if (run.length >= MIN_RUN) {
      items.push({ kind: "tool-run", id: `run-${run[0].id}`, messages: run });
    } else {
      for (const m of run) items.push({ kind: "message", message: m });
    }
    run = [];
  };

  for (const msg of messages) {
    if (msg.role === "tool" && isFoldable(msg)) {
      run.push(msg);
    } else {
      flush();
      items.push({ kind: "message", message: msg });
    }
  }
  flush();
  return items;
}

// ─── Friendly family labels ─────────────────────────────────────────────────
//
// Plain words for what a tool family does, not the tool's wire name — a
// non-technical customer reads "email, sheets, files", never "gmail,
// google_sheets, file_write". Same longest-prefix-wins idiom as
// lib/chat/orb-state.ts's PREFIX_RULES, for the same reason: a new rule can
// be added anywhere in the list without worrying about shadowing an existing
// one. Deliberately a curated list, not exhaustive — every real tool name is
// read from services/sontara/src/tools/mod.rs (2026-10-01), but an unmapped
// tool is not a bug: it falls back to "tools", which is still true.
/** [name prefix, plain-language family] pairs; longest prefix wins. */
export type FamilyRules = ReadonlyArray<readonly [string, string]>;

/** The tool tables a host may swap. Omitted = Sontara's own, so every existing
 *  call behaves as it did. A host with its own tool names (CrimeMiner) passes
 *  its own prefix rules. */
export interface ToolTables {
  familyRules?: FamilyRules;
}

export const DEFAULT_FAMILY_RULES: FamilyRules = [
  // Google Workspace — specific products before the umbrella tool.
  ["google_calendar", "calendar"],
  ["google_sheets", "sheets"],
  ["google_slides", "slides"],
  ["google_docs", "docs"],
  ["google_drive", "drive"],
  ["google_workspace", "workspace"],
  ["gmail", "email"],
  ["document_", "docs"],
  // Files on the agent's own workspace.
  ["file_", "files"],
  ["list_files", "files"],
  ["artifact_read", "files"],
  ["read_document", "files"],
  ["read_xlsx", "files"],
  ["unzip", "files"],
  // Memory.
  ["memory_", "memory"],
  // Code / shell.
  ["shell", "code"],
  ["bash", "code"],
  ["python_repl", "code"],
  ["grep", "code"],
  // The open web.
  ["web_read", "web"],
  ["web_search", "web"],
  ["browser", "web"],
  // Visuals / sites.
  ["image_generate", "images"],
  ["website", "website"],
  // Reaching people.
  ["circle_", "circle"],
  ["ask_agent", "circle"],
  // Third-party integrations.
  ["github", "github"],
  ["linkedin", "linkedin"],
  ["microsoft_graph", "microsoft"],
  ["composio", "integrations"],
  // Misc.
  ["cron_", "schedule"],
  ["security_", "security"],
  ["mcp_setup", "setup"],
];

// LONGEST PREFIX WINS — same reasoning as orb-state.ts's SORTED_RULES:
// declaration order is a trap, sorting once means a new rule is safe to add
// anywhere above.
function sortRules(rules: FamilyRules): FamilyRules {
  return [...rules].sort((a, b) => b[0].length - a[0].length);
}
const SORTED_FAMILY_RULES = sortRules(DEFAULT_FAMILY_RULES);

/**
 * The plain-language family a tool belongs to. MCP tools are namespaced
 * `mcp_{server}__{tool}` (same convention orb-state.ts classifies on) — the
 * SERVER name is the more honest label ("zapier", not "tools"). Unknown
 * tools fall back to "tools" rather than guessing.
 */
export function toolFamily(
  toolName: string | undefined,
  { familyRules }: ToolTables = {},
): string {
  if (!toolName) return "tools";
  const name = toolName.toLowerCase();
  if (name.startsWith("mcp_")) {
    const sep = name.indexOf("__");
    if (sep > "mcp_".length) return name.slice("mcp_".length, sep);
  }
  for (const [prefix, label] of familyRules
    ? sortRules(familyRules)
    : SORTED_FAMILY_RULES) {
    if (name.startsWith(prefix)) return label;
  }
  return "tools";
}

/** Families seen in a run, in order of first appearance, deduplicated. */
function uniqueFamilies(rows: GroupableRow[], tables: ToolTables): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of rows) {
    const label = toolFamily(r.toolName, tables);
    if (!seen.has(label)) {
      seen.add(label);
      out.push(label);
    }
  }
  return out;
}

/** A run lists at most this many distinct families by name before summing up
 *  the rest — the whole point of folding is to stop stuffing the user's head,
 *  so the label itself must not become another wall of words. */
const MAX_FAMILIES_SHOWN = 4;

function familiesLabel(rows: GroupableRow[], tables: ToolTables): string {
  const families = uniqueFamilies(rows, tables);
  if (families.length === 0) return "";
  const shown = families.slice(0, MAX_FAMILIES_SHOWN);
  const extra = families.length - shown.length;
  return ` · ${shown.join(", ")}${extra > 0 ? ` +${extra} more` : ""}`;
}

/** The row to show live progress for, while the run is still going. The
 *  agent loop can fire tool calls in parallel (DECISIONS 2026-09-22: "two
 *  `web_read`s fired in parallel"), so results don't always land in call
 *  order — the LAST row still running (by call order, not resolve order) is
 *  the one answer that stays consistent regardless. undefined once nothing
 *  in the run is running. Exported so the orb and the label agree on which
 *  row "current" means. */
export function currentlyRunning<T extends GroupableRow>(rows: T[]): T | undefined {
  for (let i = rows.length - 1; i >= 0; i--) {
    if (rows[i].toolStatus === "running") return rows[i];
  }
  return undefined;
}

/**
 * "Worked through 56 steps · email, sheets, files" once the run is done;
 * "Working through 12 steps · sheets" while it's still running — present
 * tense, and only the CURRENT tool's family (what's happening right now),
 * not the whole set, which mirrors a single live orb rather than a
 * retrospective list. Failures land as a suffix so the amber styling has a
 * single thing to key off.
 */
export function summarizeToolRun(
  rows: GroupableRow[],
  tables: ToolTables = {},
): string {
  const n = rows.length;
  const stepWord = n === 1 ? "step" : "steps";
  const running = currentlyRunning(rows);
  if (running) {
    return `Working through ${n} ${stepWord} · ${toolFamily(running.toolName, tables)}`;
  }
  const failed = rows.filter((m) => m.toolStatus === "error").length;
  const base = `Worked through ${n} ${stepWord}${familiesLabel(rows, tables)}`;
  return failed > 0 ? `${base} · ${failed} failed` : base;
}

// ─── Row glyphs ─────────────────────────────────────────────────────────────
//
// Which icon a tool row wears, by name. A glyph is a KEY, not a component: each
// face binds it to its own icon set (lucide-react on web, lucide-react-native
// on mobile), so the name→glyph decision is made once and can't drift.

export type ToolGlyph =
  | "terminal"
  | "file-read"
  | "file-write"
  | "file-delete"
  | "database"
  | "search"
  | "eraser"
  | "shield"
  | "plug"
  | "globe"
  | "wrench";

/** Glyph tables a host may swap, like ToolTables. `exact` is checked first;
 *  `fallback` answers for names it does not hold (default: Sontara's prefix
 *  families, then the wrench). A host with its own tool names passes its own
 *  `exact` and `() => "wrench"`. */
export interface GlyphTables {
  exact?: Readonly<Record<string, ToolGlyph>>;
  fallback?: (name: string) => ToolGlyph;
}

export const DEFAULT_EXACT_GLYPHS: Readonly<Record<string, ToolGlyph>> = {
  shell: "terminal",
  bash: "terminal",
  file_read: "file-read",
  file_write: "file-write",
  file_delete: "file-delete",
  memory_store: "database",
  memory_recall: "search",
  memory_search: "search",
  memory_forget: "eraser",
  memory_stats: "database",
  memory_reindex: "database",
  security_policy: "shield",
  mcp_setup: "plug",
  browser: "globe",
  browser_open: "globe",
  browser_service: "globe",
};

/** Exact names first, then prefix families, then the wrench. */
export function toolGlyph(
  name: string,
  { exact: table = DEFAULT_EXACT_GLYPHS, fallback = prefixGlyph }: GlyphTables = {},
): ToolGlyph {
  return Object.prototype.hasOwnProperty.call(table, name) ? table[name] : fallback(name);
}

function prefixGlyph(name: string): ToolGlyph {
  if (name.startsWith("memory_")) return "database";
  if (name.startsWith("file_") && name.includes("read")) return "file-read";
  if (name.startsWith("file_")) return "file-write";
  if (name.startsWith("browser_")) return "globe";
  if (name.startsWith("mcp_")) return "plug";
  if (name.startsWith("security_") || name.startsWith("approval_")) return "shield";
  if (name.includes("shell") || name.includes("exec") || name.includes("bash")) return "terminal";
  return "wrench";
}
