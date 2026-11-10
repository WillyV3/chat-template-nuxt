// @vitest-environment happy-dom
// Pins the one property that protects a long conversation from the composer:
// the rows must stay memoized, or every keystroke re-renders every message
// (report 230cdb93: the tab died mid-sentence on a long chat). The draft lives
// in the room composable, so the transcript SHELL re-renders with it; the
// message rows are the layer that must not. React.memo became "a child only
// re-renders when a prop changed", so pin that: a parent re-render that hands
// TranscriptRows value-equal props renders no row.
import { createApp, h, nextTick, ref } from "vue";
import { describe, expect, it } from "vitest";

import TranscriptRows from "./transcript-rows.vue";
import type { Renderers } from "./renderers";

describe("TranscriptRows", () => {
  it("does not re-render its rows when the parent re-renders with the same props", async () => {
    let rowRenders = 0;
    const renderers: Renderers = {
      assistant: { Component: () => (rowRenders++, h("p", "row")) },
    };
    const messages = [{ id: "a", role: "assistant" as const, content: "hello" }];
    const draft = ref("");
    const rows = {
      messages,
      renderers,
      context: {},
      agentUrl: "",
      token: "",
      containerWidth: null,
      onRewind: () => {},
    };
    const el = document.createElement("div");
    const app = createApp({
      render: () => h("div", [draft.value, h(TranscriptRows, { ...rows } as never)]),
    });
    app.mount(el);
    expect(rowRenders).toBe(1);

    draft.value = "typing"; // a keystroke: the shell re-renders, the rows' props are identical
    await nextTick();
    expect(el.textContent).toContain("typing");
    expect(rowRenders).toBe(1);
    app.unmount();
  });
});
