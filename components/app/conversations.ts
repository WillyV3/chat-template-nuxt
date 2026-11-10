// Example sessions for the sessions panel. Replace with your own store (DB, API, local
// storage): the panel only needs { id, title }, the room only needs a gateway.
import type { HistoryMessage } from "@/components/chat/core/chat-history";

export type Conversation = { id: string; title: string; history: HistoryMessage[] };

const ago = (min: number) => Date.now() - min * 60_000;

export const EXAMPLE_CONVERSATIONS: Conversation[] = [
  {
    id: "welcome",
    title: "Welcome",
    history: [],
  },
  {
    id: "trip",
    title: "Plan a weekend trip",
    history: [
      { role: "user", content: "Plan a weekend in Lisbon for two.", timestamp: ago(90) },
      { role: "assistant", content: "", toolCalls: [{ id: "c1", name: "web_search", args: { query: "Lisbon weekend itinerary" } }] },
      { role: "tool", content: "5 results", toolName: "web_search", toolCallId: "c1", success: true, timestamp: ago(89) },
      {
        role: "assistant",
        content: "**Saturday:** Alfama walk, tram 28, dinner in Bairro Alto.\n\n**Sunday:** Belém, pastéis, sunset at Miradouro da Senhora do Monte.",
        timestamp: ago(89),
      },
    ],
  },
  {
    id: "sql",
    title: "Explain a SQL join",
    history: [
      { role: "user", content: "What's the difference between LEFT and INNER join?", timestamp: ago(60 * 26) },
      {
        role: "assistant",
        content: "An `INNER JOIN` keeps only rows that match on both sides. A `LEFT JOIN` keeps every row from the left table and fills the right side with `NULL` when there is no match.",
        timestamp: ago(60 * 26),
      },
    ],
  },
  ...([
    ["regex", "Regex for emails", "Is there a regex that validates every email?", "No regex covers the full spec. Check for one `@` and a dot in the domain, then send a confirmation email.", 60 * 30],
    ["standup", "Standup notes", "Turn these notes into a standup update.", "**Yesterday:** shipped the export. **Today:** billing page. **Blocked:** nothing.", 60 * 50],
    ["names", "Name the cat", "Ten names for a grey cat.", "Smoke, Ash, Pebble, Earl, Nimbus, Graphite, Flint, Mist, Slate, Dusty.", 60 * 24 * 4],
    ["recipe", "Weeknight dinner", "Something fast with chickpeas?", "Crispy chickpeas with spinach, garlic and lemon over rice. Twenty minutes.", 60 * 24 * 9],
  ] as const).map(([id, title, q, a, min]) => ({
    id,
    title,
    history: [
      { role: "user", content: q, timestamp: ago(min + 1) },
      { role: "assistant", content: a, timestamp: ago(min) },
    ],
  })),
];
