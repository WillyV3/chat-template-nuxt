// Generative UI (json-render): what the model may build. Server-safe, so your
// backend can import GEN_UI_PROMPT into its system prompt.
//
// The model answers in plain text and, when a UI helps, appends a ```spec
// fence of JSONL patches. That is ordinary text, so it travels over any
// gateway (the mock, Sontara's, an AI SDK route) with no wire changes; the
// chat renders the fence as live components (see ./gen-ui.vue).
//
// To narrow or extend: pick entries from shadcnComponentDefinitions, add your
// own { props: z.object(...), description }, and register the matching
// component in ./registry.ts.

import { defineCatalog } from "@json-render/core";
import { schema } from "@json-render/vue/schema";
import { z } from "zod";
import { shadcnComponentDefinitions } from "./definitions";

// @json-render/vue 0.21.4's schema lacks the FILTERED LISTS rule that
// @json-render/react's has (same core, same renderer feature). Re-add it in the
// same slot so GEN_UI_PROMPT stays byte-identical to the React template's (tested).
const FILTERED_LISTS =
  'FILTERED LISTS: To render only the items matching a field value (kanban columns, tabbed lists, status sections), put "repeat" and a "visible" condition with $item on the same container element: {"repeat": {"statePath": "/tasks", "key": "id"}, "visible": {"$item": "status", "eq": "todo"}} renders one child per matching item. A visible condition object must use exactly one of $state, $item, or $index \u2014 never combine them in one object.';
const rules = [...(schema.defaultRules ?? [])];
rules.splice(rules.findIndex((r) => r.startsWith("NAMED SLOTS")) + 1, 0, FILTERED_LISTS);
const reactEquivalentSchema = { ...schema, defaultRules: rules };

export const catalog = defineCatalog(reactEquivalentSchema, {
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
