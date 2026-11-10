// Pure formatting + classification for the chat transcript.
//
// Extracted from agent-chat.tsx (2,303 lines) on 2026-08-07 as step 1 of
// making that file something you can add to. These are the only pieces of it
// that are genuinely PURE — no React, no DOM, no refs — which is exactly why
// they go first: they are the part that can be proven by a test today.
//
// `toolIcon` deliberately did NOT come with them. It returns a LucideIcon and
// needs ~15 react component imports, so it is a component concern wearing a
// helper's clothes; it stays in the component tree.
//
// The rest of agent-chat is a connected machine (shared refs, effect ordering)
// and is being taken apart in ordered steps rather than all at once.

/** Strip internal memory-context XML blocks.
 *
 *  Two patterns, not one: a CLOSED block anywhere, and an UNCLOSED block that
 *  runs to end-of-string. The second matters because the transcript renders
 *  tokens as they stream — a half-arrived block must not flash at the user
 *  before its closing tag lands. */
export function cleanContent(raw: string): string {
  return raw
    .replace(/<memory-context[\s\S]*?<\/memory-context>/g, "")
    .replace(/<memory-context[\s\S]*$/g, "")
    .trim();
}

/** "just now" → "12s ago" → "5m ago" → "3h ago" → "2d ago" → a locale date.
 *
 *  `now` is injectable so this is testable without freezing the clock. It
 *  defaults to Date.now(), so every existing caller is unchanged. */
export function formatRelativeTime(ms?: number, now: number = Date.now()): string {
  if (!ms) return "";
  const diff = now - ms;
  const s = Math.floor(diff / 1000);
  if (s < 10) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ms).toLocaleDateString();
}

export function formatAbsoluteTime(ms?: number): string {
  if (!ms) return "";
  return new Date(ms).toLocaleString();
}

/** Tools that touch the world outside the agent's own workspace — the ones a
 *  first-time user is warned about before the agent runs one.
 *
 *  Module scope on purpose: a Set rebuilt each render becomes a changing
 *  dependency for the effect that decides whether to show the disclosure, and
 *  that effect must not re-fire on every keystroke. */
export const REAL_WORLD_TOOLS: ReadonlySet<string> = new Set([
  "shell", "exec", "bash", "python_repl",
  "file_write", "write_to_file", "file_edit", "edit_file",
  "gmail", "email_send", "resend_send", "send_email",
  "google_calendar", "google_drive", "google_docs", "google_sheets", "google_slides",
  "browser_open", "browser",
  "cron_create",
  "composio",
  "send_message", "slack_send", "discord_send", "telegram_send", "whatsapp_send",
]);

/** Does this tool reach outside the workspace? Exact membership — NOT a prefix
 *  match, because "file_read" must stay false while "file_write" is true.
 *  A host with its own tool names passes its own set (an empty one disables
 *  the disclosure). */
export function isRealWorldTool(
  name: string,
  tools: ReadonlySet<string> = REAL_WORLD_TOOLS
): boolean {
  return tools.has(name);
}
