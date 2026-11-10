// THE MESSAGE-RENDERER REGISTRY: one dispatch point mapping message kinds
// (user / assistant / relay-sent / tool:{toolName}) to the component that
// draws them. The transcript loop renders <TranscriptMessage> per row and
// never branches on kind itself.
//
// This file is host-neutral (CrimeMiner vendors it): the base entries only.
// Sontara's rich tool cards live in sontara-renderers, which spreads
// RENDERERS. To add componentry: write the component, add ONE entry keyed
// "tool:<toolName>" (or a host role) to the host's map, no loop changes.
//
// A renderer's `Component` is a Vue component that takes MessageRenderContext
// as props (declare the ones it reads; the rest fall through as attrs).

import { h, type Component, type FunctionalComponent } from "vue";

import type { ChatMessage } from "@/components/chat/core/chat-model";
import Message from "../ui/message.vue";
import MessageContent from "../ui/message-content.vue";
import type { ChatRoomConfig, MessageAction } from "./room-config";
import AssistantMessageBubble from "../assistant-message-bubble.vue";
import UserMessageBubble from "../user-message-bubble.vue";
import ToolCall from "../tool-call.vue";

/** Any host's row: extra roles and extra (optional) fields allowed. */
export type AnyRow = ChatMessage<string>;

/** Everything a message renderer may need. Wide but UNIFORM: every renderer
 *  takes this one shape, so adding a renderer never changes the loop. `M` is
 *  the host's row type; `X` is host-only context (Sontara's site build). */
export type MessageRenderContext<M extends AnyRow = ChatMessage, X extends object = object> = {
  msg: M;
  agentUrl: string;
  token: string;
  /** Transcript column width, for the user bubble's shrinkwrap layout. */
  containerWidth?: number | null;
  /** Rewind by message id: puts that message's text back in the composer. */
  onRewind: (msgId: string) => void;
  /** Focus a person in the relay panel by clerk id. Absent = no relay panel. */
  onFocusPerson?: (personId: string) => void;
  /** A `shared/...` link click in an assistant message opens that file in the
   *  Files preview instead of downloading it. Absent = unchanged download. */
  onOpenFile?: (path: string) => void;
  /** ChatRoomConfig["tool"].orbFor / .glyphs, for the single-row orb and icon.
   *  Absent = Sontara's. */
  orbFor?: NonNullable<ChatRoomConfig["tool"]>["orbFor"];
  glyphs?: NonNullable<ChatRoomConfig["tool"]>["glyphs"];
  /** ChatRoomConfig.messageActions for this row, drawn after copy and rewind. */
  actions?: MessageAction<string>[];
} & X;

export type RendererEntry<M extends AnyRow = ChatMessage, X extends object = object> = {
  /** Optional gate: return false to fall through to the next, more generic
   *  kind (e.g. an errored image_generate falls back to the plain tool row). */
  when?: (msg: M) => boolean;
  /** A Vue component whose props are MessageRenderContext<M, X>. */
  Component: Component;
};

export type Renderers<M extends AnyRow = ChatMessage, X extends object = object> = Record<
  string,
  RendererEntry<M, X>
>;

// ─── Renderers ──────────────────────────────────────────────────────────────

// Function components with no `props` option: every prop the loop passes
// arrives in `props`, nothing falls through onto a DOM element.
type Ctx = MessageRenderContext<AnyRow>;

/** Sent-relay bubble: a record that you sent this, with a jump into the
 *  conversation. Live status and the answer live in the network panel; the
 *  chat no longer polls for either. */
const RelaySentBubble: FunctionalComponent<Ctx> = ({ msg, onFocusPerson }) => {
  // id shape: relay-sent-<personId>-<messageId>. personId is a Clerk id
  // (user_…, never contains a dash); the messageId after it is a UUID (all
  // dashes), so the person is exactly the first dash-segment.
  const personId = msg.id.slice("relay-sent-".length).split("-")[0]!;
  return h(Message, { from: "user" }, () =>
    h("div", { class: "flex min-w-0 flex-col items-end gap-1" }, [
      h(MessageContent, { variant: "flat" }, () => msg.content),
      onFocusPerson &&
        h(
          "button",
          {
            type: "button",
            onClick: () => onFocusPerson(personId),
            class:
              "cursor-pointer rounded px-1 text-[11px] font-medium text-primary underline-offset-2 hover:underline",
          },
          "Open conversation",
        ),
    ]),
  );
};

const ToolRow: FunctionalComponent<Ctx> = ({ msg, orbFor, glyphs }) =>
  h(ToolCall, {
    toolName: msg.toolName ?? "",
    status: msg.toolStatus,
    args: msg.toolArgs,
    output: msg.content,
    createdAtMs: msg.createdAtMs,
    durationMs: msg.toolDurationMs,
    orbFor,
    glyphs,
  });

const UserRow: FunctionalComponent<Ctx> = ({ msg, containerWidth, onRewind, actions }) =>
  h(UserMessageBubble, {
    msg,
    containerWidth: containerWidth ?? null,
    onRewind: () => onRewind(msg.id),
    actions,
  });

const AssistantRow: FunctionalComponent<Ctx> = ({ msg, agentUrl, token, onRewind, onOpenFile, actions }) =>
  h(AssistantMessageBubble, {
    msg,
    onRewind: () => onRewind(msg.id),
    agentUrl,
    token,
    onOpenFile,
    actions,
  });

// Function components with no `props` option inherit every attr onto their root
// by default, which would merge the loop's `onRewind` into the bubble's own
// (an array, not a function). They hand props down explicitly instead.
for (const fc of [RelaySentBubble, ToolRow, UserRow, AssistantRow]) fc.inheritAttrs = false;

// ─── Registry ───────────────────────────────────────────────────────────────

/** The base map every host spreads: `{ ...RENDERERS, "tool:foo": { Component } }`.
 *  Keep the host's map at module level: the transcript's rows re-render when it changes. */
export const RENDERERS: Renderers<AnyRow> = {
  "relay-sent": { Component: RelaySentBubble },
  tool: { Component: ToolRow },
  user: { Component: UserRow },
  assistant: { Component: AssistantRow },
};

/** Candidate kinds for a message, most specific first: the relay-sent id
 *  prefix wins, then a tool-specific renderer, then the generic row for the
 *  role (a host role like "notice" is its own kind). */
export function kindsFor(msg: AnyRow): string[] {
  if (msg.id.startsWith("relay-sent-")) return ["relay-sent"];
  if (msg.role === "tool") return [`tool:${msg.toolName}`, "tool"];
  return [msg.role];
}

export function entryFor<M extends AnyRow, X extends object>(msg: M, renderers: Renderers<M, X>) {
  for (const kind of kindsFor(msg)) {
    const entry = renderers[kind];
    if (entry && (!entry.when || entry.when(msg))) return { kind, entry };
  }
  return null;
}

/** True when this tool row renders as a dedicated card rather than the plain
 *  generic ToolCall. Walks the SAME dispatch TranscriptMessage uses, so "is
 *  this special" can never drift from what renders: the transcript uses it
 *  to keep those cards out of the folded tool-run summary. */
export function isSpecialToolRow<M extends AnyRow, X extends object>(
  msg: M,
  renderers: Renderers<M, X>,
): boolean {
  if (msg.role !== "tool") return false;
  const hit = entryFor(msg, renderers);
  return hit !== null && hit.kind !== "tool";
}
