// The room's view layer, rendered to static markup: what the composer shows for
// voice.state and composer.slot, what the transcript hides for tool.hidesThinking,
// and the pill captions.

import { createSSRApp, h, ref, type VNode } from "vue";
import { renderToString } from "vue/server-renderer";
import { describe, expect, it } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import { pillCaption } from "./attachment-tray";
import ChatComposer from "./chat-composer.vue";
import { composerPlaceholder } from "./composer";
import ChatTranscript from "./chat-transcript.vue";
import { RENDERERS } from "./renderers";

const html = (node: () => VNode) => renderToString(createSSRApp({ render: node }));

function composer(props: Record<string, unknown> = {}) {
  return html(() =>
    h(TooltipProvider, null, () =>
      h(ChatComposer, {
        textareaRef: ref(null),
        input: "",
        onInputChange: () => {},
        onKeyDown: () => {},
        onPaste: () => {},
        connected: true,
        hasAttachments: false,
        showStop: false,
        onSubmit: () => {},
        onAbort: () => {},
        ...props,
      } as never),
    ),
  );
}

describe("voice.state drives the composer", () => {
  it("the placeholder follows the voice state, then connectivity", async () => {
    expect(composerPlaceholder("listening", true)).toBe("Listening...");
    expect(composerPlaceholder("idle", true)).toBe("Message your agent...");
    expect(composerPlaceholder(undefined, false)).toBe("Connecting...");
    expect(await composer({ voiceState: "listening" })).toContain('placeholder="Listening..."');
  });

  it("the status line shows for listening, processing and speaking, and not when idle", async () => {
    expect(await composer({ voiceState: "idle" })).not.toContain("Processing...");
    expect(await composer({ voiceState: "processing" })).toContain("Processing...");
    expect(await composer({ voiceState: "speaking" })).toContain("Speaking...");
    expect(await composer({ voiceState: "listening" })).toContain("animate-pulse");
  });

  it("voice.controls render in the composer", async () => {
    expect(await composer({ voiceControls: h("button", { "data-mic": "host" }) })).toContain('data-mic="host"');
  });
});

describe("composer.slot", () => {
  it("is anchored above the input box", async () => {
    const out = await composer({ composerSlot: h("div", { "data-slot-evidence": "mention" }) });
    const slotAt = out.indexOf("data-slot-evidence");
    expect(slotAt).toBeGreaterThan(-1);
    expect(slotAt).toBeLessThan(out.indexOf("<textarea"));
  });
});

describe("send gating", () => {
  it("canSend=false disables the send button even with text", async () => {
    // Vue renders a boolean attribute bare (`disabled`), not `disabled=""`.
    const send = (out: string) => /<button[^>]*aria-label="Send message"[^>]*>/.exec(out)?.[0] ?? "";
    expect(send(await composer({ input: "hi", canSend: true }))).not.toMatch(/\sdisabled[\s=>]/);
    expect(send(await composer({ input: "hi", canSend: false }))).toMatch(/\sdisabled[\s=>]/);
  });
});

describe("attach pills", () => {
  it("shows size and path once settled, and Uploading… while in flight", () => {
    expect(pillCaption({ uploading: true })).toBe("Uploading…");
    expect(pillCaption({ size: 2048, path: "Reports/plan.pdf" })).toBe("2.0 KB · Reports/plan.pdf");
    expect(pillCaption({ path: "uploads/a.csv" })).toBe("uploads/a.csv");
  });
});

describe("transcript", () => {
  const rows = {
    messages: [{ id: "a", role: "assistant" as const, content: "hello there" }],
    renderers: RENDERERS,
    context: {},
    agentUrl: "",
    token: "",
    containerWidth: null,
    onRewind: () => {},
  };
  const shell = (hideThinking: boolean) =>
    html(() =>
      h(TooltipProvider, null, () =>
        h(ChatTranscript, {
          rows,
          omittedCount: 0,
          contentBoxRef: ref(null),
          isAgentTyping: true,
          streamingId: null,
          hideThinking,
          activeOrb: "working",
          thinkingLabel: "Doing the thing…",
          after: h("i", { "data-after": "slot" }),
        } as never),
      ),
    );

  it("shows the thinking row, and tool.hidesThinking removes it", async () => {
    expect(await shell(false)).toContain("Doing the thing…");
    expect(await shell(true)).not.toContain("Doing the thing…");
  });

  it("slots.afterTranscript draws inside the scroll area, after the rows", async () => {
    const out = await shell(true);
    expect(out.indexOf("data-after")).toBeGreaterThan(out.indexOf("hello there"));
  });
});
