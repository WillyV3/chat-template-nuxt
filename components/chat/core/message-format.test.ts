import { describe, it, expect } from "vitest";
import {
  cleanContent,
  formatRelativeTime,
  formatAbsoluteTime,
  isRealWorldTool,
  REAL_WORLD_TOOLS,
} from "./message-format";

// FIRST tests this chat code has ever had. agent-chat.tsx has 2,303 lines and
// zero automated proof — apps/web/vitest.config.mts is environment:"node" and
// there is not one .test.tsx under app/. These cover the pieces that CAN be
// proven without a DOM, which is why they were extracted first.

describe("cleanContent", () => {
  it("keeps ordinary text untouched", () => {
    expect(cleanContent("hello there")).toBe("hello there");
  });

  it("strips a closed memory-context block", () => {
    expect(cleanContent("before<memory-context>secret</memory-context>after"))
      .toBe("beforeafter");
  });

  // The case that matters while STREAMING: tokens arrive progressively, so a
  // block exists without its closing tag for a moment. If that leaked, the
  // user would watch internal memory context type itself out on screen.
  it("strips an UNCLOSED block running to end-of-string", () => {
    expect(cleanContent("visible<memory-context>half-arrived internals"))
      .toBe("visible");
  });

  it("strips several blocks in one message", () => {
    expect(cleanContent("a<memory-context>x</memory-context>b<memory-context>y</memory-context>c"))
      .toBe("abc");
  });

  it("handles a block with attributes and newlines", () => {
    expect(cleanContent('keep<memory-context id="3">\nline\nline\n</memory-context>')).toBe("keep");
  });

  it("trims the result", () => {
    expect(cleanContent("  padded  ")).toBe("padded");
  });
});

describe("formatRelativeTime", () => {
  const NOW = 1_700_000_000_000;
  const ago = (ms: number) => formatRelativeTime(NOW - ms, NOW);

  it("returns empty for a missing timestamp", () => {
    expect(formatRelativeTime(undefined, NOW)).toBe("");
    expect(formatRelativeTime(0, NOW)).toBe("");
  });

  it("walks the units", () => {
    expect(ago(3_000)).toBe("just now");
    expect(ago(30_000)).toBe("30s ago");
    expect(ago(5 * 60_000)).toBe("5m ago");
    expect(ago(3 * 3_600_000)).toBe("3h ago");
    expect(ago(2 * 86_400_000)).toBe("2d ago");
  });

  // Boundaries, because every one of these is an off-by-one waiting to happen.
  it("switches exactly at each boundary", () => {
    expect(ago(9_999)).toBe("just now");
    expect(ago(10_000)).toBe("10s ago");
    expect(ago(59_000)).toBe("59s ago");
    expect(ago(60_000)).toBe("1m ago");
    expect(ago(59 * 60_000)).toBe("59m ago");
    expect(ago(60 * 60_000)).toBe("1h ago");
    expect(ago(23 * 3_600_000)).toBe("23h ago");
    expect(ago(24 * 3_600_000)).toBe("1d ago");
    expect(ago(6 * 86_400_000)).toBe("6d ago");
  });

  it("falls back to a date past a week", () => {
    const out = ago(8 * 86_400_000);
    expect(out).not.toContain("ago");
    expect(out.length).toBeGreaterThan(0);
  });
});

describe("formatAbsoluteTime", () => {
  it("returns empty for a missing timestamp", () => {
    expect(formatAbsoluteTime(undefined)).toBe("");
    expect(formatAbsoluteTime(0)).toBe("");
  });

  it("renders something for a real timestamp", () => {
    expect(formatAbsoluteTime(1_700_000_000_000).length).toBeGreaterThan(0);
  });
});

describe("isRealWorldTool — gates the first-action warning", () => {
  it("flags tools that reach outside the workspace", () => {
    for (const t of ["shell", "gmail", "browser_open", "cron_create", "slack_send"]) {
      expect(isRealWorldTool(t)).toBe(true);
    }
  });

  // The distinction the warning exists for: reading is not acting.
  it("does NOT flag read-only tools", () => {
    for (const t of ["file_read", "list_files", "memory_recall", "artifact_read"]) {
      expect(isRealWorldTool(t)).toBe(false);
    }
  });

  it("is exact membership, not a prefix match", () => {
    expect(isRealWorldTool("file_write")).toBe(true);
    expect(isRealWorldTool("file_write_extra")).toBe(false);
    expect(isRealWorldTool("")).toBe(false);
  });

  // "browser" and "browser_open" are BOTH listed, and both are needed — this
  // pins that, because a "redundant entry" cleanup would break one of them.
  it("keeps both browser spellings", () => {
    expect(isRealWorldTool("browser")).toBe(true);
    expect(isRealWorldTool("browser_open")).toBe(true);
  });

  it("exposes the set as read-only data the disclosure effect can depend on", () => {
    expect(REAL_WORLD_TOOLS.size).toBeGreaterThan(20);
  });

  it("uses the set a host passes instead of Sontara's", () => {
    const mine = new Set(["case_export"]);
    expect(isRealWorldTool("case_export", mine)).toBe(true);
    expect(isRealWorldTool("shell", mine)).toBe(false);
  });

  it("an empty set flags nothing", () => {
    expect(isRealWorldTool("shell", new Set())).toBe(false);
  });
});
