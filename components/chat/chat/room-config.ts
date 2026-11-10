// The contract between the chat room and its host (Sontara web, CrimeMiner).
// Design + answers to crimeminer-chat's questions: docs/archive/2026-11-chat-room-package.md.
// Field names are frozen; later additions are optional fields only (marked "Added in step 2").
import type { MaybeRefOrGetter } from "vue";
import type { Component } from "vue";
import type { Attachment, ChatAction, ChatMessage, ChatState } from "@/components/chat/core/chat-model";
import type { ToolGlyph, ToolTables } from "@/components/chat/core/group-tool-runs";
import type { GatewayHook } from "../lib/use-gateway";
import type { OrbState } from "../lib/orb-state";
import type { Renderers } from "./renderers";
import type { RoomNode } from "./room-node";

/** A lucide icon component (@lucide/vue). */
type LucideIcon = Component;

type Gateway = Pick<GatewayHook, "rpc" | "on" | "off">;

/** R = host roles ("notice"), E = host row fields ({ caseIds?: string[] }),
 *  S = host state, A = host actions, X = host render context. */
export type ChatRoomConfig<
  R extends string = never,
  E extends object = object,
  S extends object = object,
  A = never,
  X extends object = object,
> = {
  /** The host's useGateway() result. The package exports useGateway; the room takes its result.
   *  `connected` may be a ref (useGateway's) or a plain boolean/getter (a test double). */
  gateway: Gateway & { connected: MaybeRefOrGetter<boolean> };
  /** url + token: REST base for download links in rows. name absent = "your agent". */
  agent: { url: string; token: string; name?: string; avatarUrl?: string | null };
  /** Replaces useUser(): the room never imports Clerk. */
  user: { timezone?: string };

  /** Host state and actions ride core's chatReducer. */
  state?: { initial: S; reduce: (s: ChatState<S, R, E>, a: A | ChatAction<R, E>) => ChatState<S, R, E> };

  /** One registry for every row: base roles, host roles, `tool:<name>`. */
  renderers: Renderers<ChatMessage<R, E>, X>;
  /** Called inside a computed: it re-runs when the reactive state it reads changes, and the
   *  result is kept (same object) while its fields are shallow-equal, so a fresh object per call
   *  never re-renders the rows. Keep function-valued fields stable. */
  renderContext?: (room: RoomApi<R, E, S, A>) => X;
  /** Rows → rows before render (CrimeMiner's case markers). */
  decorateRows?: (rows: ChatMessage<R, E>[]) => ChatMessage<R, E>[];
  messageActions?: (msg: ChatMessage<R, E>) => MessageAction<R, E>[];

  tool?: {
    tables?: ToolTables;
    orbFor?: (toolName: string | undefined) => OrbState;
    glyphs?: Partial<Record<ToolGlyph, LucideIcon>>;
    /** One-line label for a tool row; null = the default. */
    label?: (name: string, args: Record<string, unknown> | undefined, output: string) => string | null;
    thinking?: (toolName: string | undefined) => string;
    /** Added in step 2. true = this running tool's own card carries the orb, so the generic thinking row is hidden. */
    hidesThinking?: (toolName: string) => boolean;
  };

  files?: { onOpen?: (path: string) => void };

  send?: {
    /** Extra chat.send params every turn (Sontara: circleNames). */
    params?: () => Record<string, unknown>;
    /** Runs first. A throw aborts the send and becomes the error row. */
    before?: (ctx: SendCtx) => Promise<void>;
    /** The text the agent sees; the bubble keeps what the user typed. */
    transform?: (text: string, ctx: SendCtx) => string;
    /** Fields stored on the user row (CrimeMiner: caseIds). */
    tagRow?: (ctx: SendCtx) => Partial<E>;
    /** Added in step 2. Runs after `before`, composer submits only. true = the host handled it: no chat.send, the composer clears. */
    intercept?: (ctx: SendCtx, room: RoomApi<R, E, S, A>) => boolean | Promise<boolean>;
    /** Added in step 2. false = send disabled (e.g. waiting on another agent). */
    canSend?: () => boolean;
  };
  history?: {
    /** Rebuilds tagRow's fields from a reloaded user turn and strips the prefix. */
    parseUserText?: (content: string) => { text: string; extra?: Partial<E> };
  };

  /** Host listeners and side effects (tool results, site.*, theme.set, pollers).
   *  Runs once in the room's setup(), so it may call composables (watch, onMounted, ...);
   *  the room is reactive through its getters (room.state, room.input). Default: no-op. */
  useHost?: (room: RoomApi<R, E, S, A>) => void;

  /** Added in step 2. Hooks on the composer textarea (the @-mention picker). */
  composer?: {
    /** Every typed change (not setInput). */
    onInput?: (text: string, room: RoomApi<R, E, S, A>) => void;
    /** true = handled; the room then skips its own Enter-to-send. */
    onKeyDown?: (e: KeyboardEvent, room: RoomApi<R, E, S, A>) => boolean;
    /** Anchored just above the input box (a popover, target chips). Read room state with useRoom(). */
    slot?: RoomNode;
  };

  attach?: {
    /** Replaces the workspace upload and receives every file. Each result is a pill; its note
     *  joins the outgoing text. image/* is ALSO inlined for vision, so the model sees the photo. */
    onFiles: (files: File[], room: RoomApi<R, E, S, A>) => Promise<AttachResult[]>;
    hint?: string;
    /** false = send disabled (CrimeMiner: still uploading). */
    canSend?: () => boolean;
  };

  voice?: {
    /** Every streamed delta. Both faces speak it per sentence through @sontara/voice. */
    onStreamDelta?: (content: string, isFinal: boolean) => void;
    /** Mic and conversation-mode controls stay host-owned. */
    controls?: RoomNode;
    /** Added in step 2. Drives the composer placeholder, the status line and the listening orb. */
    state?: VoiceState;
  };

  /** Sent once after history loads (Sontara queuedPrompt, CrimeMiner askOnConnect). */
  initialPrompt?: string;
  empty?: { greeting?: RoomNode; chips?: { label: string; prompt: string }[]; node?: RoomNode };
  slots?: { banner?: RoomNode; aboveApprovals?: RoomNode; aboveComposer?: RoomNode; afterTranscript?: RoomNode; dialogs?: RoomNode };
  /** Transient notices (queued send). Default: vue-sonner's toast.info. */
  notify?: (text: string) => void;
};

export type VoiceState = "idle" | "listening" | "processing" | "speaking";

export type RoomApi<R extends string = never, E extends object = object, S extends object = object, A = never> = {
  state: ChatState<S, R, E>;
  dispatch: (a: A | ChatAction<R, E>) => void;
  /** Host-initiated send: runs before/transform/tagRow/params, skips `intercept`. */
  send: (text: string, opts?: { attachments?: Attachment[]; attached?: AttachResult[] }) => void;
  appendRows: (rows: ChatMessage<R, E>[]) => void;
  abort: () => void;
  /** Added in step 2: the composer draft. */
  input: string;
  /** Added in step 2: replace the draft. focus puts the caret at the end. */
  setInput: (text: string, opts?: { focus?: boolean }) => void;
  /** Added in step 2: add a pill from outside the picker (a workspace file). Same path as attach.onFiles results. */
  attach: (result: AttachResult) => void;
} & Gateway;

/** attached = this turn's attach.onFiles results, so transform/tagRow can use them. */
export type SendCtx = { text: string; attachments: Attachment[]; attached: AttachResult[] };
/** meta: host data per pill (CrimeMiner: caseId, docId); the room never reads it. */
export type AttachResult = {
  label: string;
  path?: string;
  note?: string;
  meta?: unknown;
  /** Added in step 2: bytes, shown on the pill. */
  size?: number;
};
export type MessageAction<R extends string = never, E extends object = object> = {
  label: string;
  icon?: LucideIcon;
  run: (msg: ChatMessage<R, E>) => void;
};
