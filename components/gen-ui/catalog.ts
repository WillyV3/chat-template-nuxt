// Generative UI (json-render): what the model may build. Server-safe, so your
// backend can import GEN_UI_PROMPT into its system prompt.
//
// The model answers in plain text and, when a UI helps, appends a ```spec
// fence of JSONL patches. That is ordinary text, so it travels over any
// gateway (the mock, Sontara's, an AI SDK route) with no wire changes; the
// chat renders the fence as live components (see ./gen-ui.tsx).
//
// To narrow or extend: pick entries from shadcnComponentDefinitions, add your
// own { props: z.object(...), description }, and register the matching
// component in gen-ui.tsx.

import { defineCatalog } from "@json-render/core";
import { schema } from "@json-render/react/schema";
import { shadcnComponentDefinitions } from "@json-render/shadcn/catalog";
import { z } from "zod";

export const catalog = defineCatalog(schema, {
  components: shadcnComponentDefinitions,
  actions: {
    send_message: {
      params: z.object({ text: z.string() }),
      description: "Send `text` to the assistant as if the user typed it. Use for follow-up buttons.",
    },
  },
});

/** Append to your system prompt. Teaches the model the catalog and the
 *  text + ```spec answer format. */
export const GEN_UI_PROMPT = catalog.prompt({ mode: "inline" });
