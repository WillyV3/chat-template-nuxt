import { describe, expect, it } from "vitest";
import { sessionSummary } from "./summary";

const T = Date.parse("2026-11-09T12:00:00Z");

describe("sessionSummary", () => {
  it("is undefined for a session with no messages", () => {
    expect(sessionSummary("a", [])).toBeUndefined();
  });

  it("uses the last user/assistant message with text, skipping tool rows and empty tool-call turns", () => {
    const s = sessionSummary("a", [
      { role: "user", content: "plan a trip", timestamp: T },
      { role: "assistant", content: "**Saturday:** walk", timestamp: T + 1 },
      { role: "assistant", content: "", toolCalls: [{ name: "web_search" }] },
      { role: "tool", content: "5 results", toolName: "web_search" },
    ]);
    expect(s).toEqual({
      person_id: "a",
      last_id: "a:1",
      last_body: "Saturday: walk",
      last_at: new Date(T + 1).toISOString(),
      last_from_me: false,
    });
  });

  it("marks the row as mine when I spoke last, and the id moves with each new message", () => {
    const s = sessionSummary("a", [
      { role: "assistant", content: "hi", timestamp: T },
      { role: "user", content: "thanks", timestamp: T + 1 },
    ]);
    expect(s?.last_from_me).toBe(true);
    expect(s?.last_id).toBe("a:1");
  });
});
