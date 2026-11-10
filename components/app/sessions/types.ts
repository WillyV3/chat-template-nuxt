// The shapes the vendored Messages-panel code (logic.ts, conversation-row.tsx)
// runs on, copied from Sontara: Peer (circle/use-people), ConversationSummary
// (core/org-network), ThreadMessage (circle/conversation-view). Here a "peer"
// is a chat session: id = session id, name = its title.

export interface Peer {
  id: string; name: string; imageUrl?: string | null;
  /** Identifies the person when display names collide — settings needs it. */
  email?: string | null;
  /** Their self-published one-liner (HITL: they wrote and published it). */
  status?: string | null;
}

export interface ConversationSummaryRow {
  person_id: string;
  last_id: string;
  last_body: string;
  last_at: string;
  /** true when the latest message is mine (nothing new to read). */
  last_from_me: boolean;
}

export interface ThreadMessage {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
}
