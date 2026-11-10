// @vitest-environment happy-dom
import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

import ToolRunGroup from "./tool-run-group.vue";

const rows = [
  { id: "a", role: "tool", toolName: "search_evidence", toolStatus: "done" },
  { id: "b", role: "tool", toolName: "search_evidence", toolStatus: "running" },
];

describe("ToolRunGroup host tables", () => {
  it("labels with the host's families and asks the host's orb mapping", () => {
    const orbFor = vi.fn(() => "listening" as const);
    const wrapper = mount(ToolRunGroup, {
      props: { messages: rows, tables: { familyRules: [["search_", "evidence"]] }, orbFor },
    });
    expect(wrapper.html()).toContain("Working through 2 steps · evidence");
    expect(orbFor).toHaveBeenCalledWith("search_evidence");
  });
});
