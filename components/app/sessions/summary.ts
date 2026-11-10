// A session's row in the sessions panel = its latest message, in the shape
// Sontara's panel code reads (ConversationSummaryRow). Built from the same
// chat.history any backend serves, so the panel needs no extra endpoint.
import type { HistoryMessage } from "@/components/chat/core/chat-history";
import type { ConversationSummaryRow } from "./types";

export function sessionSummary(id: string, history: HistoryMessage[]): ConversationSummaryRow | undefined {
  for (let i = history.length - 1; i >= 0; i--) {
    const m = history[i];
    if ((m.role !== "user" && m.role !== "assistant") || !m.content.trim()) continue;
    return {
      person_id: id,
      last_id: `${id}:${i}`,
      last_body: m.content.replace(/[*_`#>]/g, "").replace(/\s+/g, " ").trim(),
      last_at: new Date(m.timestamp ?? Date.now()).toISOString(),
      last_from_me: m.role === "user",
    };
  }
  return undefined;
}
