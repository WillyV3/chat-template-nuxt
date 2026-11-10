// React's ReactNode slots, in Vue. A host builds its slots before the room
// exists, so a slot is a vnode, a component, or a render function; the room
// draws it with <RoomNodeView>. Anything inside reads the room with useRoom()
// (provided by <ChatRoomView>).

import { h, isVNode, type Component, type FunctionalComponent, type VNodeChild } from "vue";

export type RoomNode = VNodeChild | Component | (() => VNodeChild);

/** Draws a RoomNode. A plain function is a render function (call it); an object is a component. */
export const RoomNodeView: FunctionalComponent<{ node?: RoomNode }> = (props) => {
  const node = props.node;
  if (typeof node === "function") return (node as () => VNodeChild)() as never;
  if (node && typeof node === "object" && !isVNode(node) && !Array.isArray(node)) {
    return h(node as Component);
  }
  return node as never;
};
RoomNodeView.props = ["node"];
