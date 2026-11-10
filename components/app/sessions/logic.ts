// Circle messaging — the PURE logic behind the Messages panel and a thread.
// Extracted from relay-panel/conversation-view (2026-08-26) so the real rules
// (roster merge, unread derivation, day grouping, optimistic append) are one
// testable module and the components stay renderers. Same discipline as
// chat/model.ts.

import type { ConversationSummaryRow, Peer, ThreadMessage } from "./types";

export interface RosterRow {
  peer: Peer;
  lane: "org" | "peer";
}

/** The conversation list: team members first (org lane wins for people in
 *  both), then the circle, then anyone you have HISTORY with who is no longer
 *  connected — disconnect keeps history (the dialog promises it), so those
 *  threads must stay reachable, named honestly. */
export function rosterRows(
  members: Peer[],
  peerContacts: Peer[],
  convs: ConversationSummaryRow[],
): RosterRow[] {
  const rows: RosterRow[] = [
    ...members.map((p) => ({ peer: p, lane: "org" as const })),
    ...peerContacts
      .filter((p) => !members.some((m) => m.id === p.id))
      .map((p) => ({ peer: p, lane: "peer" as const })),
  ];
  const known = new Set(rows.map((r) => r.peer.id));
  for (const c of convs) {
    if (!known.has(c.person_id)) {
      rows.push({ peer: { id: c.person_id, name: "Former connection" }, lane: "peer" });
    }
  }
  return rows;
}

/** Unread = the latest message in a conversation is theirs and you haven't
 *  opened it (seenReplies is the localStorage-backed per-conversation memory). */
export function isUnread(
  conv: ConversationSummaryRow | undefined,
  seenReplies: ReadonlySet<string>,
): boolean {
  return !!conv && !conv.last_from_me && !seenReplies.has(conv.last_id);
}

/** BADGE = "something arrived since you last opened the panel" — a stricter
 *  cut of unread, so a message you dealt with elsewhere can't light the
 *  button forever (the 2026-07-27 stale-badge lesson). `quiet` = muted ∪
 *  archived people: their rows still show unread dots, but they never ring
 *  the button — that is what mute means. */
export function freshCount(
  convs: ConversationSummaryRow[],
  seenReplies: ReadonlySet<string>,
  panelSeenAtMs: number,
  quiet: ReadonlySet<string> = new Set(),
): number {
  return convs.filter(
    (c) =>
      !quiet.has(c.person_id) &&
      isUnread(c, seenReplies) &&
      new Date(c.last_at).getTime() > panelSeenAtMs,
  ).length;
}

/** Split the roster into the live list and the archived shelf. Archived is
 *  the user's explicit set — a new message does NOT unarchive (the row shows
 *  its unread dot on the shelf instead). */
export function partitionRoster(
  rows: RosterRow[],
  archived: ReadonlySet<string>,
): { active: RosterRow[]; archived: RosterRow[] } {
  const active: RosterRow[] = [];
  const shelved: RosterRow[] = [];
  for (const r of rows) (archived.has(r.peer.id) ? shelved : active).push(r);
  return { active, archived: shelved };
}

/** Case-insensitive name filter for the conversation list. Empty term =
 *  everyone. */
export function filterRoster(rows: RosterRow[], term: string): RosterRow[] {
  const q = term.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((r) => r.peer.name.toLowerCase().includes(q));
}

/** Append the just-POSTed message unless the poll already delivered it —
 *  the 30s refresh and the optimistic append race, and an id-dedup is the
 *  whole fix (server ids are the identity, order stays chronological). */
export function appendSent(
  messages: ThreadMessage[],
  sent: ThreadMessage,
): ThreadMessage[] {
  return messages.some((m) => m.id === sent.id) ? messages : [...messages, sent];
}

/** "Today" / "Yesterday" / "Aug 12" / "Aug 12, 2025" — the day-separator
 *  label. `now` is a parameter so tests don't depend on the wall clock. */
export function dayLabel(iso: string, now: Date): string {
  const d = new Date(iso);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(d, now)) return "Today";
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(d, yesterday)) return "Yesterday";
  return d.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    ...(d.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
  });
}

export interface DayGroup {
  /** The separator label — also the React key (labels are unique per thread). */
  label: string;
  messages: ThreadMessage[];
}

/** Chronological messages → day-separated groups, order preserved. */
export function groupByDay(messages: ThreadMessage[], now: Date): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const m of messages) {
    const label = dayLabel(m.created_at, now);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.messages.push(m);
    else groups.push({ label, messages: [m] });
  }
  return groups;
}

export type BodyPart =
  | { kind: "text"; value: string }
  | { kind: "link"; value: string };

/** Split a message body into text and http(s) link parts, in order — the
 *  renderer turns link parts into anchors. Pure split, no markup: rendering
 *  stays React elements so nothing here can inject HTML. Trailing sentence
 *  punctuation stays text (the classic "https://x.com/." paste). */
export function bodyParts(body: string): BodyPart[] {
  const parts: BodyPart[] = [];
  const re = /https?:\/\/[^\s<>"']+/g;
  let last = 0;
  for (const m of body.matchAll(re)) {
    let url = m[0];
    // Peel trailing punctuation that reads as prose, not address.
    while (/[.,!?;:)\]]$/.test(url)) url = url.slice(0, -1);
    if (m.index > last) parts.push({ kind: "text", value: body.slice(last, m.index) });
    parts.push({ kind: "link", value: url });
    last = m.index + url.length;
  }
  if (last < body.length) parts.push({ kind: "text", value: body.slice(last) });
  return parts;
}

/** Compact row time for the conversation list: "2m", "3h", "Tue", "Aug 12". */
export function rowTime(iso: string, now: Date): string {
  const ms = now.getTime() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return new Date(iso).toLocaleDateString([], { weekday: "short" });
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
}
