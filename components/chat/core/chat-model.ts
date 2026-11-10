// The chat's pure state layer: the message shapes a conversation is made of and
// the reducer for everything that is not specific to one face. Pure on purpose:
// no React, no DOM, no clocks. Anything impure (ids, Date.now(), RPC payload
// massaging) happens in the host and rides in on the action, which is what
// keeps this unit-testable in node.
//
// Born in apps/web chat/model.ts and moved here (2026-11-02) so CrimeMiner can
// vendor it. This file imports NOTHING: copy it beside its siblings in one flat
// folder and it resolves alone.
//
// A host adds its own state with `ChatState<Extra>`, its own roles with
// `ChatMessage<"hitl">`, and its own actions by wrapping `chatReducer` (web's
// model.ts is the worked example: it intercepts a few core actions, delegates
// the rest, and owns relay / site / mention state itself).

// ─── Message shapes ─────────────────────────────────────────────────────────

/** An image pasted or attached in the composer, carried inline with the
 *  message so the agent sees it in the same turn. */
export type Attachment = {
  id: string;
  mimeType: string;
  content: string; // base64
  preview: string; // data URL for display
  name: string;
  /** Folder-picker destination under shared/ (e.g. "Images"). Sent on the wire
   *  so the agent persists the image to the chosen folder, not just Uploads.
   *  Absent → server defaults to shared/Uploads. */
  path?: string;
};

export type ToolStatus = "running" | "done" | "error";

/** The roles every host has. A host adds more through `ChatMessage<"hitl">`. */
export type BaseRole = "user" | "assistant" | "tool";

/** One row in the transcript. `role` decides which bubble renders it; a row
 *  with role "tool" carries the toolName/toolStatus/toolArgs triple instead of
 *  prose. `HostRole` is the roles a host adds on top of the base three: the
 *  default (`never`) keeps `role` exactly "user" | "assistant" | "tool", so
 *  narrowing on it works as it always did. `RowExtra` is the fields a host
 *  declares on its own rows (`{ citations?: string[] }`). They MUST be optional:
 *  the rows the reducer builds itself (stream and tool rows) carry none.
 *  TypeScript cannot express "all optional" as a constraint on a generic, so
 *  this is by contract, and the reducer holds one cast (`hostRow`) where it
 *  builds those rows. */
export type ChatMessage<
  HostRole extends string = never,
  RowExtra extends object = object,
> = {
  id: string;
  role: BaseRole | HostRole;
  content: string;
  toolName?: string;
  toolStatus?: ToolStatus;
  toolArgs?: Record<string, unknown>;
  /** How long the tool actually took, measured when its result arrived. Set
   *  ONLY on rows we watched run — a row rebuilt from history has no measured
   *  duration and must not display one. */
  toolDurationMs?: number;
  streaming?: boolean;
  attachments?: Attachment[];
  createdAtMs?: number;
} & RowExtra;

// ─── State ──────────────────────────────────────────────────────────────────

type BaseChatState<HostRole extends string, RowExtra extends object> = {
  messages: ChatMessage<HostRole, RowExtra>[];
  /** Agent is working but nothing has streamed yet — the thinking orb. */
  isAgentTyping: boolean;
  /** WHICH message is currently streaming, or null. The reducer is the single
   *  writer, so the old ref/state double-bookkeeping (a ref for synchronous
   *  socket reads, state for render) is gone: every action sees the value the
   *  previous action wrote, and the render sees the same one. */
  streamingId: string | null;
  /** Number of older messages on disk that were NOT returned by chat.history
   *  (server-side cap at CHAT_HISTORY_DISPLAY_LIMIT, plus anything previously
   *  moved to conversation_history.archive.jsonl by auto-trim). When > 0 we
   *  show a small stub at the top of the chat so the user knows older context
   *  exists and the agent still has it via memory_recall. */
  omittedCount: number;
  /** Initial chat.history load lifecycle. `attempt` is the retry counter — a
   *  cold agent (scaled to zero) fails the first chat.history, and without a
   *  retry that failure was permanent.
   *  joinedRun: the engine said a turn is running that this mount did not start. */
  history: { loaded: boolean; attempt: number; joinedRun: boolean };
};

/** The generic state plus whatever fields the host adds (`Extra`). */
export type ChatState<
  Extra extends object = object,
  HostRole extends string = never,
  RowExtra extends object = object,
> = BaseChatState<HostRole, RowExtra> & Extra;

/** The generic fields at their starting values; the host supplies its own. */
export function initialChatState<Extra extends object>(
  extra: Extra
): ChatState<Extra> {
  return {
    messages: [],
    isAgentTyping: false,
    streamingId: null,
    omittedCount: 0,
    history: { loaded: false, attempt: 0, joinedRun: false },
    ...extra,
  };
}

// ─── Actions ────────────────────────────────────────────────────────────────
// Impure inputs (row ids, Date.now()) are generated by the dispatcher and
// carried on the action, so the reducer stays deterministic. Streamed content
// arrives already cleaned by the host, exactly where the old socket handlers
// cleaned it.
//
// `active` on history/loaded and history/resynced is `chat.history`'s flag with
// THREE states: true = a turn is running, false = it ended, missing = the
// caller does not know. The reducer cases below say what missing does.

export type ChatAction<
  HostRole extends string = never,
  RowExtra extends object = object,
> =
  // History lifecycle
  | {
      type: "history/loaded";
      rows: ChatMessage<HostRole, RowExtra>[];
      omittedCount: number;
      active?: boolean;
    }
  | { type: "history/attemptBumped" }
  | { type: "history/gaveUp" }
  | {
      type: "history/resynced";
      rows: ChatMessage<HostRole, RowExtra>[];
      omittedCount: number;
      active?: boolean;
    }
  // Streaming
  | { type: "stream/delta"; runId?: string; content: string; now: number }
  | { type: "stream/final"; runId?: string; content: string; now: number }
  | { type: "stream/error"; content: string; now: number }
  | { type: "stream/aborted" }
  // Tool events
  | {
      type: "tool/called";
      id: string;
      toolName: string;
      args?: Record<string, unknown>;
      now: number;
    }
  | {
      type: "tool/resolved";
      toolName: string;
      output: string;
      isError: boolean;
      /** Row id used ONLY when no running row matches (orphaned result). */
      orphanId: string;
      now: number;
    }
  // Sends
  | { type: "send/started"; message: ChatMessage<HostRole, RowExtra> }
  | { type: "send/failed"; errorRow?: ChatMessage<HostRole, RowExtra> }
  | { type: "message/appended"; message: ChatMessage<HostRole, RowExtra> }
  /** Merge `patch` into the row with this id. An unknown id is a no-op. */
  | {
      type: "message/patched";
      id: string;
      patch: Partial<Omit<ChatMessage<HostRole>, "id">> & Partial<RowExtra>;
    };

// ─── Reducer ────────────────────────────────────────────────────────────────

/** The run is over, so nothing it started is still running. A tool that resolved
 *  in the instant before a mid-turn load has no event left to resolve its row.
 *  A joined run keeps polling, so the engine's record corrects "done" within
 *  one resync if that tool failed. Exported for a host that handles a
 *  run-ending action itself (web's relay capture). */
export function settleRun<
  Extra extends object,
  HostRole extends string,
  RowExtra extends object = object,
>(
  state: ChatState<Extra, HostRole, RowExtra>
): ChatState<Extra, HostRole, RowExtra> {
  return {
    ...state,
    messages: state.messages.map((m) =>
      m.role === "tool" && m.toolStatus === "running" ? { ...m, toolStatus: "done" } : m
    ),
  };
}

/** Index of the most recent still-running row for this tool, or -1. */
export function findRunningToolIndex<RowExtra extends object = object>(
  messages: ChatMessage<string, RowExtra>[],
  toolName: string
): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role === "tool" && m.toolName === toolName && m.toolStatus === "running") {
      return i;
    }
  }
  return -1;
}

export function chatReducer<
  Extra extends object = object,
  HostRole extends string = never,
  RowExtra extends object = object,
>(
  state: ChatState<Extra, HostRole, RowExtra>,
  action: ChatAction<HostRole, RowExtra>
): ChatState<Extra, HostRole, RowExtra> {
  const next = applyAction(state, action);
  return action.type === "stream/final" ||
    action.type === "stream/error" ||
    action.type === "stream/aborted"
    ? settleRun(next)
    : next;
}

/** The one cast: a row the reducer builds has no host fields, which is valid
 *  because host fields are optional (see ChatMessage). */
function hostRow<HostRole extends string, RowExtra extends object>(
  row: ChatMessage<HostRole>
): ChatMessage<HostRole, RowExtra> {
  return row as ChatMessage<HostRole, RowExtra>;
}

function applyAction<
  Extra extends object,
  HostRole extends string,
  RowExtra extends object,
>(
  state: ChatState<Extra, HostRole, RowExtra>,
  action: ChatAction<HostRole, RowExtra>
): ChatState<Extra, HostRole, RowExtra> {
  switch (action.type) {
    case "history/loaded":
      return {
        ...state,
        messages: action.rows,
        omittedCount: action.omittedCount,
        // Opened mid-turn: the run is live even though this mount never sent it.
        // Missing `active` adds nothing here and never claims a run ended: the
        // typing state and joinedRun both keep what they were.
        isAgentTyping: state.isAgentTyping || action.active === true,
        history: {
          ...state.history,
          loaded: true,
          joinedRun: action.active ?? state.history.joinedRun,
        },
      };

    case "history/attemptBumped":
      return {
        ...state,
        history: { ...state.history, attempt: state.history.attempt + 1 },
      };

    case "history/gaveUp":
      // Give up, but only after really trying (the host gates on the attempt
      // count) — latching `loaded` is what stops the load effect re-firing.
      return { ...state, history: { ...state.history, loaded: true } };

    case "history/resynced": {
      // Resync from the engine's record. Carry over a message that's actively
      // streaming on the new socket so the resync doesn't drop a live response
      // in progress; otherwise the engine says whether a run is still going.
      // Missing `active` with nothing streaming clears the typing state (and
      // joinedRun): a resync is the caller's final word on the run.
      const live = state.messages.find((m) => m.streaming);
      const active = action.active ?? false;
      return {
        ...state,
        messages: live ? [...action.rows, live] : action.rows,
        omittedCount: action.omittedCount,
        isAgentTyping: state.streamingId ? state.isAgentTyping : active,
        history: { ...state.history, joinedRun: active },
      };
    }

    case "stream/delta": {
      if (!state.streamingId) {
        // An empty first delta (a tool-calling turn) must not open the row:
        // tool rows would append after it and the answer render above its run.
        if (!action.content) return state;
        const id = action.runId ?? `msg-${action.now}`;
        return {
          ...state,
          streamingId: id,
          isAgentTyping: false,
          messages: [
            ...state.messages,
            hostRow({
              id,
              role: "assistant",
              content: action.content,
              streaming: true,
              createdAtMs: action.now,
            }),
          ],
        };
      }
      const id = state.streamingId;
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.id === id ? { ...m, content: action.content } : m
        ),
      };
    }

    case "stream/final": {
      const id = state.streamingId;
      if (id) {
        return {
          ...state,
          streamingId: null,
          isAgentTyping: false,
          messages: state.messages.map((m) =>
            m.id === id
              ? { ...m, content: action.content, streaming: false }
              : m
          ),
        };
      }
      return {
        ...state,
        streamingId: null,
        isAgentTyping: false,
        messages: [
          ...state.messages,
          hostRow({
            id: action.runId ?? `msg-${action.now}`,
            role: "assistant",
            content: action.content,
            createdAtMs: action.now,
          }),
        ],
      };
    }

    case "stream/error":
      return {
        ...state,
        streamingId: null,
        isAgentTyping: false,
        messages: [
          ...state.messages,
          hostRow({
            id: `err-${action.now}`,
            role: "assistant",
            content: action.content,
            createdAtMs: action.now,
          }),
        ],
      };

    case "stream/aborted":
      return { ...state, streamingId: null, isAgentTyping: false };

    // Model: one row per tool invocation. tool/called appends a row with
    // status="running" and the args. tool/resolved walks back to find the most
    // recent running row for the same tool and updates it in place
    // (status + output). Avoids the noisy "Calling X..." + "Done" duplication.
    case "tool/called":
      return {
        ...state,
        messages: [
          ...state.messages,
          hostRow({
            id: action.id,
            role: "tool",
            content: "",
            toolName: action.toolName,
            toolStatus: "running",
            toolArgs: action.args,
            createdAtMs: action.now,
          }),
        ],
      };

    case "tool/resolved": {
      const status: ToolStatus = action.isError ? "error" : "done";
      const matchIdx = findRunningToolIndex(state.messages, action.toolName);
      if (matchIdx === -1) {
        // Orphaned result (shouldn't happen, but render it anyway)
        return {
          ...state,
          messages: [
            ...state.messages,
            hostRow({
              id: action.orphanId,
              role: "tool",
              content: action.output,
              toolName: action.toolName,
              toolStatus: status,
              createdAtMs: action.now,
            }),
          ],
        };
      }
      const next = [...state.messages];
      const startedAt = next[matchIdx].createdAtMs;
      next[matchIdx] = {
        ...next[matchIdx],
        content: action.output,
        toolStatus: status,
        toolDurationMs: startedAt ? action.now - startedAt : undefined,
      };
      return { ...state, messages: next };
    }

    case "send/started":
      return {
        ...state,
        isAgentTyping: true,
        messages: [...state.messages, action.message],
      };

    case "send/failed":
      return {
        ...state,
        isAgentTyping: false,
        messages: action.errorRow
          ? [...state.messages, action.errorRow]
          : state.messages,
      };

    case "message/appended":
      return { ...state, messages: [...state.messages, action.message] };

    case "message/patched": {
      if (!state.messages.some((m) => m.id === action.id)) return state;
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.id === action.id ? { ...m, ...action.patch } : m
        ),
      };
    }
  }
}

// ─── Pure helpers ───────────────────────────────────────────────────────────

/** Rewind: the text to put back into the composer for a message.
 *  User msg -> their own text. Assistant msg -> the preceding user prompt.
 *  Real history truncation will come with a chat.rewind_to RPC later. */
export function rewindText<RowExtra extends object = object>(
  messages: ChatMessage<string, RowExtra>[],
  msgId: string
): string {
  const idx = messages.findIndex((m) => m.id === msgId);
  if (idx === -1) return "";
  const msg = messages[idx];
  if (msg.role === "user") return msg.content;
  // Walk back to find the most recent user message before this one
  for (let i = idx - 1; i >= 0; i--) {
    if (messages[i].role === "user") return messages[i].content;
  }
  return "";
}
