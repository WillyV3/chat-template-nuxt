// The room's IO, as plain functions over an injected gateway. use-chat-room.ts
// binds them to React; keeping them framework-free is what lets room-io.test.ts
// drive history retry, streaming and the send path against a fake gateway.
//
// Every name and number here is lifted from the Sontara chat hook this replaces
// (apps/web chat/use-chat.ts before the room package): behavior is unchanged.

import {
  chatReducer,
  type Attachment,
  type ChatAction,
  type ChatMessage,
} from "@/components/chat/core/chat-model";
import { historyToRows, type HistoryMessage } from "@/components/chat/core/chat-history";
import { cleanContent } from "@/components/chat/core/message-format";
import type { AgentEventPayload } from "@/components/chat/core/gateway-client";
import type { GatewayHook } from "../lib/use-gateway";
import { DEFAULT_ORB, LISTENING_ORB, orbForTool, type OrbState } from "../lib/orb-state";
import type { AttachResult, ChatRoomConfig, RoomApi, SendCtx, VoiceState } from "./room-config";

/** Initial chat.history load: how hard to try before showing an empty chat.
 *  A Cloud Run agent at zero instances can take several seconds to answer its
 *  first RPC, and that is exactly when a user switches into it. */
export const HISTORY_MAX_ATTEMPTS = 5;
export const HISTORY_RETRY_BASE_MS = 700;
export const JOINED_RUN_RESYNC_MS = 15_000;
export const SEND_RETRY_MS = 600;

/** The room works on rows and actions of any host shape; the hook narrows them
 *  back to the host's generics at its boundary. */
export type AnyRow = ChatMessage<string, object>;
export type AnyAction = ChatAction<string, object>;
type Rpc = GatewayHook["rpc"];
type On = GatewayHook["on"];
type Off = GatewayHook["off"];

// ─── Reducer composition ────────────────────────────────────────────────────

const CORE_ACTION_TYPES = new Set<string>([
  "history/loaded",
  "history/attemptBumped",
  "history/gaveUp",
  "history/resynced",
  "stream/delta",
  "stream/final",
  "stream/error",
  "stream/aborted",
  "tool/called",
  "tool/resolved",
  "send/started",
  "send/failed",
  "message/appended",
  "message/patched",
]);

/** The host reducer gets first refusal. A host that wraps core's chatReducer
 *  (Sontara) handles everything itself; one that only knows its own actions
 *  (CrimeMiner) returns the state untouched for core's, and core's reducer then
 *  runs. A host action that falls through is left alone: core has no case for it. */
export function composeReduce<St extends object, Act>(
  host: ((s: St, a: Act) => St) | undefined,
): (s: St, a: Act) => St {
  return (s, a) => {
    const core = CORE_ACTION_TYPES.has((a as { type: string }).type);
    if (host) {
      const next = host(s, a);
      if (next !== s || !core) return next;
    }
    if (!core) return s;
    return chatReducer(s as never, a as never) as unknown as St;
  };
}

// ─── History ────────────────────────────────────────────────────────────────

type HistoryReply = { messages?: HistoryMessage[]; omittedCount?: number; active?: boolean };

type ParseUserText = (content: string) => { text: string; extra?: object };

/** chat.history rows → transcript rows; parseUserText rebuilds what tagRow
 *  stored on a user turn and strips its prefix. */
export function rowsFromHistory(reply: HistoryReply, parseUserText?: ParseUserText): AnyRow[] {
  const rows = historyToRows(reply.messages ?? [], { active: reply.active }) as AnyRow[];
  if (!parseUserText) return rows;
  return rows.map((row) => {
    if (row.role !== "user") return row;
    const parsed = parseUserText(row.content);
    return { ...row, content: parsed.text, ...parsed.extra };
  });
}

type HistoryDeps = {
  rpc: Rpc;
  dispatch: (a: AnyAction) => void;
  parseUserText?: ParseUserText;
};

/** One attempt at the initial load; call again (new `attempt`) when
 *  history/attemptBumped lands. Returns the cleanup the effect hands React.
 *
 *  DO NOT latch history.loaded on failure: the load is gated on `!loaded`, so
 *  latching would permanently disable the only path that fills the transcript.
 *  The usual trigger is switching to an agent scaled to zero: the first RPC
 *  lands while the container is cold and times out. */
export function startHistoryLoad(deps: HistoryDeps & { attempt: number }): () => void {
  const { rpc, dispatch, attempt, parseUserText } = deps;
  let cancelled = false;
  let retry: ReturnType<typeof setTimeout> | undefined;

  rpc<HistoryReply>("chat.history", {})
    .then((result) => {
      if (cancelled) return;
      dispatch({
        type: "history/loaded",
        rows: rowsFromHistory(result, parseUserText),
        omittedCount: result.omittedCount ?? 0,
        active: !!result.active,
      });
    })
    .catch(() => {
      if (cancelled) return;
      if (attempt >= HISTORY_MAX_ATTEMPTS) {
        dispatch({ type: "history/gaveUp" }); // give up, but only after really trying
        return;
      }
      retry = setTimeout(
        () => dispatch({ type: "history/attemptBumped" }),
        HISTORY_RETRY_BASE_MS * (attempt + 1),
      );
    });

  return () => {
    cancelled = true;
    if (retry) clearTimeout(retry);
  };
}

/** Re-pull the persisted record (reconnect edge, joined-run poll) and reconcile.
 *  onlyIfEnded: a mid-run record lags the screen, so only its end replaces anything. */
export function resyncHistory(deps: HistoryDeps, onlyIfEnded = false): void {
  deps
    .rpc<HistoryReply>("chat.history", {})
    .then((result) => {
      if (onlyIfEnded && result.active) return;
      deps.dispatch({
        type: "history/resynced",
        rows: rowsFromHistory(result, deps.parseUserText),
        omittedCount: result.omittedCount ?? 0,
        active: !!result.active,
      });
    })
    .catch(() => {});
}

// ─── Gateway events ─────────────────────────────────────────────────────────

type ChatEvent = {
  state: "delta" | "final" | "error" | "aborted";
  runId?: string;
  message?: { role: string; content: string };
  errorMessage?: string;
};

/** `chat` events → stream actions. onDelta is read per event so a host that
 *  swaps its callback never forces a rebind. */
export function bindChatStream(deps: {
  on: On;
  off: Off;
  dispatch: (a: AnyAction) => void;
  onDelta: () => ((content: string, isFinal: boolean) => void) | undefined;
  now?: () => number;
}): () => void {
  const { on, off, dispatch } = deps;
  const now = deps.now ?? Date.now;
  function handleChat(payload: ChatEvent) {
    if (payload.state === "delta") {
      const content = cleanContent(payload.message?.content ?? "");
      dispatch({ type: "stream/delta", runId: payload.runId, content, now: now() });
      deps.onDelta()?.(content, false);
    } else if (payload.state === "final") {
      const content = cleanContent(payload.message?.content ?? "");
      dispatch({ type: "stream/final", runId: payload.runId, content, now: now() });
      deps.onDelta()?.(content, true);
    } else if (payload.state === "error") {
      dispatch({
        type: "stream/error",
        content: payload.errorMessage ?? "An error occurred.",
        now: now(),
      });
    } else if (payload.state === "aborted") {
      dispatch({ type: "stream/aborted" });
    }
  }
  on("chat", handleChat);
  return () => off("chat", handleChat);
}

/** `agent` events → tool rows. */
export function bindToolEvents(deps: {
  on: On;
  off: Off;
  dispatch: (a: AnyAction) => void;
  now?: () => number;
}): () => void {
  const { on, off, dispatch } = deps;
  const now = deps.now ?? Date.now;
  function handleAgent(payload: AgentEventPayload) {
    if (payload.type === "tool_call" && payload.tool) {
      dispatch({
        type: "tool/called",
        id: `tool-${now()}-${Math.random()}`,
        toolName: payload.tool,
        args: payload.arguments,
        now: now(),
      });
    } else if (payload.type === "tool_result" && payload.tool) {
      dispatch({
        type: "tool/resolved",
        toolName: payload.tool,
        output: payload.output ?? "",
        isError: payload.success === false,
        orphanId: `toolres-${now()}-${Math.random()}`,
        now: now(),
      });
    }
  }
  on("agent", handleAgent);
  return () => off("agent", handleAgent);
}

// ─── Send ───────────────────────────────────────────────────────────────────

/** A composer pill. The room's own uploads carry `uploaded` (the server-side
 *  name the agent file_reads); a host's attach.onFiles results carry their
 *  `note` instead. */
export type RoomPill = AttachResult & {
  id: string;
  uploading?: boolean;
  uploaded?: string;
};

type LooseSend = NonNullable<ChatRoomConfig<string, object, object, unknown>["send"]>;

export type SendEnv = {
  send?: LooseSend;
  rpc: Rpc;
  dispatch: (a: AnyAction) => void;
  room: RoomApi<string, object, object, unknown>;
  /** IANA zone sent on every turn so the agent's per-turn <session-context>
   *  can render user-local time. */
  timezone: string;
  notify: (text: string) => void;
  now?: () => number;
  retryMs?: number;
};

export type SendInput = {
  text: string;
  attachments: Attachment[];
  attached: AttachResult[];
  /** A composer submit (runs `intercept`) vs a host-initiated room.send. */
  composer: boolean;
};

export type SendOutcome = {
  status: "sent" | "handled" | "failed";
  /** Settles when the chat.send RPC (with its retry) has. */
  done: Promise<void>;
};

function errorRow(now: number, content: string): AnyRow {
  return { id: `err-${now}`, role: "assistant", content, createdAtMs: now };
}

function describe(err: unknown): string {
  return String((err as { message?: string } | null)?.message ?? err ?? "unknown error");
}

export function defaultMessage(imageCount: number, fileCount: number): string {
  return imageCount > 0
    ? "What do you see in this image?"
    : fileCount > 0
      ? `I attached ${fileCount} file(s) — please take a look.`
      : "";
}

function placeholder(text: string, imageCount: number, fileCount: number): string {
  if (text) return text;
  if (imageCount > 0 && fileCount > 0) return `[${imageCount} image(s) + ${fileCount} file(s)]`;
  if (imageCount > 0) return `[${imageCount} image(s)]`;
  return `[${fileCount} file(s)]`;
}

/** The one send path: before → intercept → row → wire text → chat.send with the
 *  600 ms retry. The bubble keeps what the user typed; only the wire changes. */
export async function runSend(env: SendEnv, input: SendInput): Promise<SendOutcome> {
  const now = env.now ?? Date.now;
  const { text, attachments } = input;
  const attached = input.attached.filter((p) => !(p as RoomPill).uploading);
  const ctx: SendCtx = { text, attachments, attached };
  const cfg = env.send;
  const none = Promise.resolve();

  try {
    await cfg?.before?.(ctx);
    if (input.composer && cfg?.intercept && (await cfg.intercept(ctx, env.room))) {
      return { status: "handled", done: none };
    }
  } catch (err) {
    // The thrown message IS the error row; no user bubble, nothing sent.
    env.dispatch({ type: "send/failed", errorRow: errorRow(now(), describe(err)) });
    return { status: "failed", done: none };
  }

  const fileCount = attached.length;
  env.dispatch({
    type: "send/started",
    message: {
      id: `user-${now()}`,
      role: "user",
      content: placeholder(text, attachments.length, fileCount),
      attachments: attachments.length > 0 ? [...attachments] : undefined,
      createdAtMs: now(),
      ...cfg?.tagRow?.(ctx),
    },
  });

  const base = text || defaultMessage(attachments.length, fileCount);
  let message = cfg?.transform ? cfg.transform(base, ctx) : base;
  // A pill's note (attach.onFiles, or a workspace file) rides the wire text,
  // never the bubble.
  const notes = attached.map((p) => p.note).filter((n): n is string => !!n);
  if (notes.length > 0) message = `${message.trimEnd()}\n\n${notes.join("\n")}`;

  const params: Record<string, unknown> = {
    ...cfg?.params?.(),
    message,
    sessionKey: "web-chat",
    clientTimezone: env.timezone,
  };
  if (attachments.length > 0) {
    params.attachments = attachments.map((a) => ({
      mimeType: a.mimeType,
      content: a.content,
      // Folder-picker destination; the server sanitizes and defaults to shared/Uploads.
      ...(a.path ? { path: a.path } : {}),
    }));
  }
  const uploaded = attached.map((p) => (p as RoomPill).uploaded).filter((n): n is string => !!n);
  // The binary (gateway/rpc.rs chat_send) prepends a note for these so the
  // agent can file_read each from the workspace.
  if (uploaded.length > 0) params.uploadedFiles = uploaded;

  // One quick retry if the first send rejects (typically the WS mid-reconnect):
  // the gateway client's backoff recovers in under a second, so 600 ms catches
  // almost every transient disconnect without making the user re-type.
  const trySend = () => env.rpc<{ status?: string } | undefined>("chat.send", params);
  const done = trySend()
    .catch((firstErr) => {
      console.warn("[chat.send] first attempt failed, retrying:", firstErr);
      return new Promise((r) => setTimeout(r, env.retryMs ?? SEND_RETRY_MS)).then(trySend);
    })
    .then((res) => {
      // The agent is still on the previous message; this one runs next.
      if (res?.status === "queued") {
        env.notify("Your agent is still finishing the last reply. This message is queued.");
      }
    })
    .catch((finalErr) => {
      console.error("[chat.send] failed after retry:", finalErr);
      env.dispatch({
        type: "send/failed",
        errorRow: errorRow(
          now(),
          `Couldn't send your message: ${describe(finalErr)}. Try again in a moment.`,
        ),
      });
    });
  return { status: "sent", done };
}

// ─── Keys ───────────────────────────────────────────────────────────────────

type KeyLike = { key: string; shiftKey: boolean; preventDefault: () => void };

/** The composer's key protocol: the host's picker first (while it is open the
 *  keys belong to it, and a handled key never also sends), then Enter sends and
 *  Shift+Enter is a newline. */
export function routeKey<E extends KeyLike>(
  hostHandles: ((e: E) => boolean) | undefined,
  e: E,
  submit: () => void,
): void {
  if (hostHandles?.(e)) return;
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    submit();
  }
}

// ─── initialPrompt ──────────────────────────────────────────────────────────

/** Sends the host's initialPrompt exactly once, and only after history has
 *  loaded: history/loaded REPLACES the message list, so a send fired earlier
 *  gets its optimistic bubble wiped. */
export function createInitialPromptGate(): (
  loaded: boolean,
  prompt: string | undefined,
  send: (text: string) => void,
) => void {
  let sent = false;
  return (loaded, prompt, send) => {
    if (sent || !loaded || !prompt) return;
    sent = true;
    send(prompt);
  };
}

// ─── What the room shows while the agent works ──────────────────────────────

/** Precedence is deliberate: the user speaking outranks anything the agent is
 *  doing, and a named running tool outranks generic thinking. Scans backwards
 *  so the MOST RECENT running tool wins when several are in flight. */
export function activeOrbFor(
  messages: AnyRow[],
  voice: VoiceState | undefined,
  orbFor: (toolName: string | undefined) => OrbState = orbForTool,
): OrbState {
  if (voice === "listening") return LISTENING_ORB;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role === "tool" && m.toolStatus === "running") return orbFor(m.toolName);
  }
  return DEFAULT_ORB;
}

/** One processing voice at a time: while a tool whose own card carries the orb
 *  is running, the generic thinking row would be a duplicate. */
export function thinkingHidden(
  messages: AnyRow[],
  hidesThinking?: (toolName: string) => boolean,
): boolean {
  if (!hidesThinking) return false;
  return messages.some(
    (m) => m.role === "tool" && m.toolStatus === "running" && !!m.toolName && hidesThinking(m.toolName),
  );
}

export function resolveTimezone(configured?: string): string {
  if (configured) return configured;
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}
