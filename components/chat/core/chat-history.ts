// `chat.history` rows → transcript rows. The ONE mapper: every face uses it, so
// a field added to the wire cannot reach one path and miss another. Each past
// copy lost something different (tool names on reconnect, failed status, args,
// quiet steps). The engine side is `history_row` in gateway/rpc.rs; both are
// pinned to services/sontara/fixtures/chat-history-wire.json.

import { cleanContent } from "./message-format";

/** A message as the engine sends it. Optional fields are genuinely optional:
 *  older engines and older persisted rows predate them. */
export interface HistoryMessage {
  role: string;
  content: string;
  timestamp?: string | number;
  toolName?: string;
  toolCallId?: string;
  /** Same word as the live `tool_result` event. */
  success?: boolean;
  /** Older persisted rows hold plain names: identity-less calls. */
  toolCalls?: ({ id?: string; name: string; args?: Record<string, unknown> } | string)[];
}

export interface HistoryRow {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  toolName?: string;
  toolStatus?: "running" | "done" | "error";
  /** Args of the call that produced this tool row, when the assistant row
   *  before it declared them: how the website done-card knows its slug. */
  toolArgs?: Record<string, unknown>;
  createdAtMs: number;
}

export interface HistoryOptions {
  /** Injected so the stagger is testable without mocking the clock. */
  now?: number;
  /** `chat.history`'s `active`: a turn is running, so a declared call with no
   *  result yet is running rather than lost. */
  active?: boolean;
}

/** Rows with no timestamp get staggered rather than stacked, so relative labels
 *  ("3m ago") don't all read identically. */
const STAGGER_MS = 30_000;

function timestampMs(raw: HistoryMessage["timestamp"]): number | undefined {
  if (typeof raw === "number") return raw;
  if (typeof raw === "string") {
    const parsed = Date.parse(raw);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return undefined;
}

export function historyToRows(
  messages: HistoryMessage[],
  { now = Date.now(), active = false }: HistoryOptions = {}
): HistoryRow[] {
  // Calls live on the ASSISTANT row; results are separate tool rows after it.
  // Pair by call id, or by first unclaimed name on rows that predate ids.
  let pending: { id?: string; name: string; args?: Record<string, unknown>; at?: number }[] = [];
  const rows: HistoryRow[] = [];
  messages.forEach((m, i) => {
    const createdAtMs = timestampMs(m.timestamp) ?? now - (messages.length - i) * STAGGER_MS;
    // A tool row if the server SAID so, or if it carries a tool name: older
    // persisted messages were written before tool rows had a role.
    const isTool = m.role === "tool" || !!m.toolName;
    if (!isTool) {
      if (m.role !== "user" && m.role !== "assistant") return;
      // A new turn: calls an interrupted turn left unanswered will never run.
      if (m.role === "user") pending = [];
      if (Array.isArray(m.toolCalls)) {
        pending = m.toolCalls.flatMap((c) =>
          typeof c === "object" && c !== null && typeof c.name === "string"
            ? [{ ...c, at: createdAtMs }]
            : []
        );
      }
      const content = cleanContent(m.content ?? "");
      // A tool-calling turn's text is often just "\n\n": no bubble for that.
      if (content) rows.push({ id: `history-${i}`, role: m.role, content, createdAtMs });
      return;
    }
    const idx = pending.findIndex((c) =>
      m.toolCallId && c.id ? c.id === m.toolCallId : c.name === m.toolName
    );
    const call = idx === -1 ? undefined : pending.splice(idx, 1)[0];
    const content = cleanContent(m.content ?? "");
    // A named tool row IS a step even with no output (`sleep`, a quiet write).
    if (!content && !m.toolName) return;
    rows.push({
      id: `history-${i}`,
      role: "tool",
      content,
      toolName: m.toolName,
      toolArgs: call?.args,
      toolStatus: m.success === false ? "error" : "done",
      createdAtMs,
    });
  });
  if (active) {
    pending.forEach((c, i) =>
      rows.push({
        id: `history-running-${i}`,
        role: "tool",
        content: "",
        toolName: c.name,
        toolArgs: c.args,
        toolStatus: "running",
        createdAtMs: c.at ?? now,
      })
    );
  }
  return rows;
}
