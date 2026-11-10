import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { genUiDemoReply } from "@/components/app/gen-ui-demo";
import { catalog, GEN_UI_PROMPT } from "./catalog";
import { shadcnComponentDefinitions } from "./definitions";
import { registry } from "./registry";
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

  // The Vue port ships its own copy of the shadcn definitions and the vue schema.
  // This fixture is the React template's prompt (node, @json-render/react schema +
  // @json-render/shadcn/catalog, 0.21.4): if it drifts, the model is taught a
  // different catalog than the React app.
  it("is byte-identical to the React template's prompt", () => {
    expect(GEN_UI_PROMPT).toBe(readFileSync(new URL("./prompt.fixture.txt", import.meta.url), "utf8"));
  });
});

describe("registry", () => {
  it("maps all 36 catalog components, nothing extra", () => {
    const names = Object.keys(shadcnComponentDefinitions).sort();
    expect(names).toHaveLength(36);
    expect(Object.keys(registry).sort()).toEqual(names);
  });
});
