// @vitest-environment happy-dom
import { mount } from "@vue/test-utils";
import { defineComponent, h, markRaw } from "vue";
import { describe, expect, it, vi } from "vitest";

import ToolCall from "./tool-call.vue";

describe("ToolCall tool seams", () => {
  it("asks the injected orbFor for the running orb and draws the injected glyph", () => {
    const orbFor = vi.fn(() => "listening" as const);
    const Stub = markRaw(defineComponent({ render: () => h("svg", { "data-stub": "evidence" }) }));
    const wrapper = mount(ToolCall, {
      props: {
        toolName: "shell",
        status: "running",
        output: "",
        orbFor,
        glyphs: { terminal: Stub as never },
      },
    });
    expect(orbFor).toHaveBeenCalledWith("shell");
    expect(wrapper.html()).toContain('data-stub="evidence"');
  });

  it("defaults to Sontara's orb and icons when nothing is injected", () => {
    const wrapper = mount(ToolCall, { props: { toolName: "shell", status: "done", output: "" } });
    expect(wrapper.html()).not.toContain("data-stub");
    expect(wrapper.html()).toContain("<svg");
  });
});
