// The composer's state as a pure reducer: the draft text, the inline images and
// the file pills. Pure on purpose (no React, no DOM, no clocks) so every way
// text or a pill can arrive (typed, setInput from the host, a picker upload, a
// host-side attach) is testable in node.

import type { Attachment } from "@/components/chat/core/chat-model";
import type { RoomPill } from "./room-io";

export type ComposerState = {
  input: string;
  /** Images, inlined as base64 for multimodal vision (chat.send `attachments`). */
  images: Attachment[];
  /** Everything else: the room's own uploads, or a host's attach results. */
  pills: RoomPill[];
};

export const EMPTY_COMPOSER: ComposerState = { input: "", images: [], pills: [] };

export type ComposerAction =
  | { type: "input/set"; text: string }
  | { type: "image/added"; image: Attachment }
  | { type: "image/removed"; id: string }
  /** A pill the room made itself (an in-flight upload). */
  | { type: "pill/added"; pill: RoomPill }
  /** A pill from outside (RoomApi.attach). Attaching the same path twice is a
   *  no-op, not a second pill. */
  | { type: "pill/attached"; pill: RoomPill }
  | { type: "pill/patched"; id: string; patch: Partial<RoomPill> }
  | { type: "pill/removed"; id: string }
  /** The message carrying all of this went out. */
  | { type: "sent" };

export function composerReducer(state: ComposerState, action: ComposerAction): ComposerState {
  switch (action.type) {
    case "input/set":
      return { ...state, input: action.text };
    case "image/added":
      return { ...state, images: [...state.images, action.image] };
    case "image/removed":
      return { ...state, images: state.images.filter((a) => a.id !== action.id) };
    case "pill/added":
      return { ...state, pills: [...state.pills, action.pill] };
    case "pill/attached": {
      const { path } = action.pill;
      if (path && state.pills.some((p) => p.path === path)) return state;
      return { ...state, pills: [...state.pills, action.pill] };
    }
    case "pill/patched":
      return {
        ...state,
        pills: state.pills.map((p) => (p.id === action.id ? { ...p, ...action.patch } : p)),
      };
    case "pill/removed":
      return { ...state, pills: state.pills.filter((p) => p.id !== action.id) };
    case "sent":
      return EMPTY_COMPOSER;
  }
}
