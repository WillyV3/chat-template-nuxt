// THE ROOM: transcript + composer + attachment tray + HITL cards + empty state,
// plus the host's slots. <ChatRoom config> is useChatRoom + <ChatRoomView>; a
// host that needs the room's state outside the room (Sontara's build stage sits
// beside it) calls useChatRoom itself and renders <ChatRoomView :room>.
//
// Slots are plain nodes built before the room exists, so they read the room
// through useRoom(), which <ChatRoomView> provides.

import { inject, type InjectionKey } from "vue";
import type { RoomApi } from "./room-config";

export const RoomKey: InjectionKey<RoomApi<string, object, object, unknown>> = Symbol("ChatRoom");

/** The room, from inside a slot, a renderer or any child of <ChatRoomView>.
 *  Its `state` and `input` are getters over refs: read them in a computed,
 *  watch or template and they are reactive. */
export function useRoom<
  R extends string = never,
  E extends object = object,
  S extends object = object,
  A = never,
>(): RoomApi<R, E, S, A> {
  const room = inject(RoomKey, null);
  if (!room) throw new Error("useRoom() was called outside a <ChatRoom>");
  return room as unknown as RoomApi<R, E, S, A>;
}
