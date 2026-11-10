import { describe, expect, it } from "vitest";

import { genUiDemoReply } from "@/components/app/gen-ui-demo";
import { catalog, GEN_UI_PROMPT } from "./catalog";
import { hasSpec, splitSpec } from "./spec-text";

const reply = genUiDemoReply();

describe("splitSpec", () => {
  it("separates prose from the spec and builds the tree", () => {
    const { text, spec } = splitSpec(reply);
    expect(text).toBe("Here is the budget as a card. The buttons send a follow-up message.");
    expect(spec?.root).toBe("card");
    expect(Object.keys(spec!.elements)).toHaveLength(10);
    expect(spec!.elements.cheaper.on).toEqual({ press: { action: "send_message", params: { text: "Find cheaper flights" } } });
  });

  it("the demo spec passes the catalog's own validation", () => {
    const r = catalog.validate(splitSpec(reply).spec);
    expect(r.success, JSON.stringify(r.error?.issues ?? r, null, 1).slice(0, 1500)).toBe(true);
  });

  it("mid-stream: applies complete lines, skips the cut-off last one", () => {
    const cut = reply.slice(0, reply.indexOf('"/elements/stack"') + 10);
    const { spec } = splitSpec(cut, true);
    expect(spec?.root).toBe("card");
    expect(spec?.elements.card).toBeDefined();
    expect(spec?.elements.stack).toBeUndefined();
  });

  it("ignores garbage and failing patches instead of throwing", () => {
    const bad = 'hi\n```spec\n{"op":"add","path":"/root","value":"a"}\nnot json\n{"op":"test","path":"/root","value":"zzz"}\n```';
    expect(splitSpec(bad)).toEqual({ text: "hi", spec: { root: "a", elements: {} } });
  });

  it("plain text has no spec", () => {
    expect(hasSpec("```ts\nconst a = 1\n```")).toBe(false);
    expect(hasSpec(reply)).toBe(true);
  });
});

describe("GEN_UI_PROMPT", () => {
  it("teaches the inline fence format and names the catalog", () => {
    expect(GEN_UI_PROMPT).toContain("```spec");
    expect(GEN_UI_PROMPT).toContain("send_message");
    expect(GEN_UI_PROMPT).toContain("Card");
  });
});
