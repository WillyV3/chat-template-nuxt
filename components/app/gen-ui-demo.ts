// EXAMPLE: the mock backend's generative-UI answer, in exactly the format a
// real model produces when its system prompt includes GEN_UI_PROMPT. Delete
// this once a real backend answers.

const patches = [
  { op: "add", path: "/root", value: "card" },
  { op: "add", path: "/elements/card", value: { type: "Card", props: { title: "Lisbon weekend", description: "Budget for two, Fri to Sun" }, children: ["stack"] } },
  { op: "add", path: "/elements/stack", value: { type: "Stack", props: { direction: "vertical", gap: "md" }, children: ["table", "progress", "badges", "actions"] } },
  { op: "add", path: "/elements/table", value: { type: "Table", props: { columns: ["Item", "Cost"], rows: [["Flights", "€310"], ["Hotel, 2 nights", "€240"], ["Food", "€150"], ["Tram + museums", "€60"]], caption: "Total €760" }, children: [] } },
  { op: "add", path: "/elements/progress", value: { type: "Progress", props: { value: 76, max: 100, label: "€760 of your €1,000 budget" }, children: [] } },
  { op: "add", path: "/elements/badges", value: { type: "Stack", props: { direction: "horizontal", gap: "sm" }, children: ["b1", "b2"] } },
  { op: "add", path: "/elements/b1", value: { type: "Badge", props: { text: "Under budget", variant: "default" }, children: [] } },
  { op: "add", path: "/elements/b2", value: { type: "Badge", props: { text: "2 nights", variant: "outline" }, children: [] } },
  { op: "add", path: "/elements/actions", value: { type: "Stack", props: { direction: "horizontal", gap: "sm" }, children: ["cheaper", "plan"] } },
  { op: "add", path: "/elements/cheaper", value: { type: "Button", props: { label: "Find cheaper flights", variant: "primary" }, on: { press: { action: "send_message", params: { text: "Find cheaper flights" } } }, children: [] } },
  { op: "add", path: "/elements/plan", value: { type: "Button", props: { label: "Plan the days", variant: "secondary" }, on: { press: { action: "send_message", params: { text: "Plan the days" } } }, children: [] } },
];

export const GEN_UI_DEMO_PROMPT = "Show me a trip budget";

export const genUiDemoReply = () =>
  "Here is the budget as a card. The buttons send a follow-up message.\n\n```spec\n" +
  patches.map((p) => JSON.stringify(p)).join("\n") +
  "\n```";
