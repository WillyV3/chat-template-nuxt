// Which orb the agent shows for what it is currently doing.
//
// ONE mapping, as data. The alternative — a conditional at each render site —
// is how the old status UI drifted: the transcript, the tool row and the
// asking-indicator each decided independently what "busy" looked like.
//
// The vocabulary is the PACKAGE's (thinking-orbs 0.2.0 ships nine hand-tuned
// states). We map OUR concepts onto it rather than inventing names, so
// upgrading the package is a data edit here and nothing else.
//
// SUPPLY-CHAIN NOTE: 0.2.0 was published 2026-08-03, inside the repo's 7-day
// npm cooldown (`before=` in ~/.npmrc). Installed with an explicit one-off
// `--before` override on Willy's direct authorisation 2026-08-07 — the cooldown
// is a deliberate control, not an obstacle to route around silently.

import type { OrbState } from "thinking-orbs";

export type { OrbState };

/** Plain thinking — no tool running. The agent is composing a reply. */
export const DEFAULT_ORB: OrbState = "working";

/** Tool name → orb, by what the tool DOES rather than by which integration it
 *  belongs to. Prefix rules, because tool names are namespaced
 *  (`mcp_{server}__{tool}`, `google_*`, `browser_*`). */
const PREFIX_RULES: ReadonlyArray<readonly [string, OrbState]> = [
  // Looking things up — reading, searching, browsing.
  ["search", "searching"],
  ["browser", "searching"],
  ["web_", "searching"],
  ["file_read", "searching"],
  ["list_files", "searching"],
  ["read_", "searching"],
  ["artifact_read", "searching"],
  ["unzip", "searching"],
  // Memory: pulling threads from several places into one answer. "weaving" —
  // three strands plaiting — says that better than a search sweep does.
  ["memory_", "weaving"],
  ["read_document", "weaving"],
  ["read_xlsx", "weaving"],
  // Running code / doing real work with a machine.
  ["shell", "solving"],
  ["website", "solving"],
  ["exec", "solving"],
  ["bash", "solving"],
  ["python", "solving"],
  ["cron_", "solving"],
  // Producing a document or a message.
  ["document_", "composing"],
  ["file_write", "composing"],
  ["write_", "composing"],
  ["edit_", "composing"],
  ["file_edit", "composing"],
  ["gmail", "composing"],
  ["email", "composing"],
  ["send_", "composing"],
  ["google_docs", "composing"],
  ["google_sheets", "composing"],
  ["google_slides", "composing"],
  ["google_calendar", "composing"],
  // Making something visual.
  ["image", "shaping"],
  ["generate_image", "shaping"],
];

/**
 * The orb for a running tool.
 *
 * Unknown tools fall back to `working` rather than guessing — a new tool
 * showing the generic "busy" orb is correct, whereas showing "searching" for
 * something that writes a file is a lie about what the agent is doing.
 */
// LONGEST PREFIX WINS, enforced here rather than by the order of the list
// above. Declaration order is a trap: `read_` sits near `read_document`, and
// whichever happened to be written first would silently claim the other's
// tools — `read_document` matched "searching" instead of "weaving" exactly
// that way, caught by a test rather than by eye. Sorting once at module load
// means a new rule can be added anywhere in the list and still behave.
const SORTED_RULES = [...PREFIX_RULES].sort((a, b) => b[0].length - a[0].length);

export function orbForTool(toolName: string | undefined): OrbState {
  if (!toolName) return DEFAULT_ORB;
  const name = toolName.toLowerCase();
  // MCP tools are namespaced `mcp_{server}__{tool}`; classify on the tool half.
  const bare = name.includes("__") ? name.slice(name.lastIndexOf("__") + 2) : name;
  for (const [prefix, state] of SORTED_RULES) {
    if (bare.startsWith(prefix) || name.startsWith(prefix)) return state;
  }
  return DEFAULT_ORB;
}

/** Plain-language caption beside the orb.
 *
 *  The orb REPLACES the shimmering text, but not the words: the audience here
 *  is non-technical, an animation alone does not say what is happening, and a
 *  screen reader gets nothing from a canvas. Ordinary verbs, no jargon — the
 *  user does not care that it is running `python_repl`, only that it is
 *  working something out. */
export const ORB_LABELS: Record<OrbState, string> = {
  working: "Thinking",
  searching: "Looking that up",
  solving: "Working it out",
  listening: "Listening",
  connecting: "Reaching your other agent",
  weaving: "Pulling it together",
  composing: "Writing",
  breathing: "Waiting for you",
  shaping: "Making an image",
};

/** Voice capture is its own state and outranks whatever tool is running —
 *  the user is talking, and that is what the orb should say. */
export const LISTENING_ORB: OrbState = "listening";

/** Reaching another agent (ask-your-own-agent, or a relay to a teammate).
 *  "connecting" is literally a constellation wiring itself with packets running
 *  the edges — the one state whose animation IS the concept. */
export const CONNECTING_ORB: OrbState = "connecting";

/** Stopped, waiting on a human: an exec approval or an MCP setup prompt.
 *  "breathing" is the only state that reads as ALIVE BUT NOT WORKING, which is
 *  exactly the truth — spinning here would imply progress that is not
 *  happening, and the agent is blocked on the person reading the screen. */
export const WAITING_ORB: OrbState = "breathing";
