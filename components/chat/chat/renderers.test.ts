import { createSSRApp, h } from "vue";
import { renderToString } from "vue/server-renderer";
import { describe, expect, it } from "vitest";

import type { ChatMessage } from "@/components/chat/core/chat-model";
import { RENDERERS, isSpecialToolRow, type Renderers } from "./renderers";
import TranscriptMessage from "./transcript-message.vue";

// A host row with its own role and field, as CrimeMiner declares it: no casts.
type HostRow = ChatMessage<"notice", { citations?: string[] }>;

const tool: HostRow = { id: "t1", role: "tool", toolName: "search_evidence", toolStatus: "running", content: "" };
const notice: HostRow = { id: "n1", role: "notice", content: "case closed", citations: ["c1"] };

const HOST: Renderers<HostRow> = {
  ...RENDERERS,
  "tool:search_evidence": { Component: () => h("i", null, "injected") },
  notice: { Component: (props: { msg: HostRow }) => h("b", null, props.msg.citations?.join(",")) },
};
const ctx = { agentUrl: "", token: "", onRewind: () => {}, renderers: HOST };

const render = (msg: HostRow) =>
  renderToString(createSSRApp({ render: () => h(TranscriptMessage, { ...ctx, msg } as never) }));

describe("injectable renderers", () => {
  it("a host map renders its own tool card and its own role", async () => {
    expect(await render(tool)).toBe("<i>injected</i>");
    expect(await render(notice)).toBe("<b>c1</b>");
  });

  it("isSpecialToolRow follows the map it is given", () => {
    expect(isSpecialToolRow(tool, HOST)).toBe(true);
    expect(isSpecialToolRow(tool, RENDERERS)).toBe(false);
  });
});
