// @vitest-environment happy-dom
import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { h } from "vue";
import { shadcnComponentDefinitions } from "./definitions";
import GenUI from "./gen-ui.vue";
import { splitSpec } from "./spec-text";
import { genUiDemoReply } from "@/components/app/gen-ui-demo";

const PROPS: Record<string, Record<string, unknown>> = {
  Tabs: { tabs: [{ label: "A", value: "a" }, { label: "B", value: "b" }] },
  Accordion: { items: [{ title: "T", content: "C" }] },
  Collapsible: { title: "Coll" },
  Dialog: { title: "Dlg", openPath: "/dlg" },
  Drawer: { title: "Drw", openPath: "/drw" },
  Carousel: { items: [{ title: "One", description: "d" }] },
  Table: { columns: ["Name"], rows: [["Alice"]] },
  Heading: { text: "Head" },
  Text: { text: "Body" },
  Image: { alt: "pic" },
  Avatar: { name: "Jane Doe" },
  Badge: { text: "Active" },
  Alert: { title: "Note" },
  Progress: { value: 50 },
  Tooltip: { content: "tip", text: "hover" },
  Popover: { trigger: "Pop", content: "c" },
  Input: { label: "Email", name: "email" },
  Textarea: { label: "Msg", name: "msg" },
  Select: { label: "Pick", name: "pick", options: ["x", "y"] },
  Checkbox: { label: "Agree", name: "agree" },
  Radio: { label: "Radio", name: "r", options: ["x", "y"] },
  Switch: { label: "Sw", name: "sw" },
  Slider: { label: "Vol", min: 0, max: 10 },
  Button: { label: "Go" },
  Link: { label: "Lnk", href: "#" },
  DropdownMenu: { label: "Menu", items: [{ label: "I", value: "i" }] },
  Toggle: { label: "Tog" },
  ToggleGroup: { items: [{ label: "L", value: "l" }, { label: "R", value: "r" }] },
  ButtonGroup: { buttons: [{ label: "One", value: "1" }, { label: "Two", value: "2" }] },
  Pagination: { totalPages: 10, page: 5 },
};

describe("GenUI", () => {
  it("renders every one of the 36 components without a Vue warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const names = Object.keys(shadcnComponentDefinitions);
    const elements: Record<string, unknown> = {
      root: { type: "Stack", props: {}, children: names.filter((n) => n !== "Stack").map((n) => `e-${n}`).concat("grid") },
      grid: { type: "Grid", props: { columns: 2 }, children: ["card"] },
      card: { type: "Card", props: { title: "CardTitle" }, children: ["sep"] },
      sep: { type: "Separator", props: {}, children: [] },
    };
    for (const n of names) if (!["Stack", "Grid", "Card", "Separator"].includes(n)) elements[`e-${n}`] = { type: n, props: PROPS[n] ?? {}, children: [] };
    elements["e-Card"] = { type: "Card", props: { title: "C2" }, children: [] };
    elements["e-Separator"] = { type: "Separator", props: {}, children: [] };
    elements["e-Spinner"] = { type: "Spinner", props: { label: "Spin" }, children: [] };
    elements["e-Skeleton"] = { type: "Skeleton", props: {}, children: [] };
    const w = mount({ render: () => h(TooltipProvider, null, () => h(GenUI, { spec: { root: "root", elements } as never })) });
    const text = w.text();
    for (const t of ["Head", "Body", "Active", "Note", "Email", "Go", "Lnk", "Menu", "Tog", "One", "Alice", "CardTitle", "Spin", "JD", "hover", "10"]) expect(text).toContain(t);
    expect(w.findAll("button").length).toBeGreaterThan(8);
    expect(warn.mock.calls.map((c) => String(c[0])).filter((m) => m.includes("Vue warn"))).toEqual([]);
  });

  it("a Button press runs the bound send_message action", async () => {
    const send = vi.fn();
    const { spec } = splitSpec(genUiDemoReply());
    const w = mount({ render: () => h(TooltipProvider, null, () => h(GenUI, { spec, handlers: { send_message: send } })) });
    await w.findAll("button").find((b) => b.text() === "Find cheaper flights")!.trigger("click");
    expect(send).toHaveBeenCalledWith({ text: "Find cheaper flights" });
  });
});
