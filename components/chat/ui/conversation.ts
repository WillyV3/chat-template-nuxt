// Context shared by <Conversation>, <ConversationContent> and
// <ConversationScrollButton> (the lib's StickToBottomContext + its hook).

import { inject, type InjectionKey } from "vue";
import type { StickToBottomContext } from "../hooks/use-stick-to-bottom";

export type { StickToBottomContext };

export const StickToBottomKey: InjectionKey<StickToBottomContext> = Symbol("StickToBottom");

/** Use inside a <Conversation> to read whether it is at the bottom, or scroll it. */
export function useStickToBottomContext(): StickToBottomContext {
  const context = inject(StickToBottomKey, null);
  if (!context) {
    throw new Error("use-stick-to-bottom component context must be used within a Conversation component");
  }
  return context;
}
