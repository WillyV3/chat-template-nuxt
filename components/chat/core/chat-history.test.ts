import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { historyToRows } from "./chat-history";

const NOW = 1_700_000_000_000;

describe("historyToRows", () => {
  // THE REGRESSION. The reconnect-resync loader dropped toolName, so every
  // historical tool call rendered as the literal "unknown" after a socket
  // drop. This is the assertion that would have failed.
  it("keeps the tool name on tool rows", () => {
    const rows = historyToRows(
      [{ role: "tool", content: "ok", toolName: "peer_status_set", timestamp: NOW }], { now: NOW });
    expect(rows[0].toolName).toBe("peer_status_set");
    expect(rows[0].role).toBe("tool");
  });

  // The bad loader cast role to "user" | "assistant". The cast is erased at
  // runtime, so the row still rendered as a tool row — just a nameless one.
  // Pinning the role keeps the two facts from drifting apart again.
  it("marks a row as a tool when it carries a name but the role does not say so", () => {
    const rows = historyToRows([{ role: "assistant", content: "x", toolName: "shell" }], { now: NOW });
    expect(rows[0].role).toBe("tool");
    expect(rows[0].toolName).toBe("shell");
  });

  // Canary receipt 2026-11-02: three `sleep` shell calls persisted as three tool
  // rows, two with empty output. Returning to the chat showed one step.
  it("keeps a finished tool step that produced no output", () => {
    const rows = historyToRows(
      [
        { role: "assistant", content: "\n\n", toolCalls: [{ name: "shell", args: { command: "sleep 8" } }] },
        { role: "tool", content: "", toolName: "shell" },
        { role: "assistant", content: "done" },
      ], { now: NOW });
    expect(rows.map((r) => r.role)).toEqual(["tool", "assistant"]);
    expect(rows[0].toolArgs).toEqual({ command: "sleep 8" });
    expect(rows[0].toolStatus).toBe("done");
  });

  it("still drops a blank text row and a nameless empty tool row", () => {
    const rows = historyToRows(
      [
        { role: "assistant", content: "\n\n" },
        { role: "tool", content: "" },
      ], { now: NOW });
    expect(rows).toEqual([]);
  });

  // The live row shows a failed tool as failed; the reloaded row said "done".
  it("restores a failed tool as failed, without the persisted marker", () => {
    const rows = historyToRows(
      [{ role: "tool", content: "exit 1: nope", toolName: "shell", success: false }], { now: NOW });
    expect(rows[0].toolStatus).toBe("error");
    expect(rows[0].content).toBe("exit 1: nope");
  });

  it("marks finished tools done, and leaves non-tools without a status", () => {
    const rows = historyToRows(
      [
        { role: "tool", content: "out", toolName: "list_agents" },
        { role: "user", content: "hi" },
      ], { now: NOW });
    expect(rows[0].toolStatus).toBe("done");
    expect(rows[1].toolStatus).toBeUndefined();
  });

  it("honours real timestamps, numeric or ISO", () => {
    const rows = historyToRows(
      [
        { role: "user", content: "a", timestamp: 1234 },
        { role: "user", content: "b", timestamp: "2026-08-07T12:00:00.000Z" },
      ], { now: NOW });
    expect(rows[0].createdAtMs).toBe(1234);
    expect(rows[1].createdAtMs).toBe(Date.parse("2026-08-07T12:00:00.000Z"));
  });

  it("staggers only the messages that have no usable timestamp", () => {
    const rows = historyToRows(
      [
        { role: "user", content: "a" },
        { role: "user", content: "b", timestamp: "not a date" },
      ], { now: NOW });
    // Two messages: index 0 is 2 slots back, index 1 is 1 slot back.
    expect(rows[0].createdAtMs).toBe(NOW - 2 * 30_000);
    expect(rows[1].createdAtMs).toBe(NOW - 1 * 30_000);
  });

  it("drops messages whose content is empty after cleaning", () => {
    const rows = historyToRows(
      [
        { role: "user", content: "<memory-context>internals</memory-context>" },
        { role: "user", content: "real" },
      ], { now: NOW });
    expect(rows).toHaveLength(1);
    expect(rows[0].content).toBe("real");
  });

  it("strips embedded memory context but keeps the visible text", () => {
    const rows = historyToRows(
      [{ role: "assistant", content: "before<memory-context>secret</memory-context>after" }], { now: NOW });
    expect(rows[0].content).not.toContain("secret");
    expect(rows[0].content).toContain("before");
  });
});

describe("tool args pairing (reloaded rich cards need their identity)", () => {
  it("attaches each call's args to the tool row that answered it", () => {
    const rows = historyToRows([
      {
        role: "assistant",
        content: "making it",
        toolCalls: [
          { name: "website", args: { action: "create", name: "northern-dashboard" } },
          { name: "file_read", args: { path: "a.txt" } },
        ],
      },
      { role: "tool", toolName: "website", content: "Created site" },
      { role: "tool", toolName: "file_read", content: "contents" },
    ]);
    expect(rows[1].toolArgs).toEqual({ action: "create", name: "northern-dashboard" });
    expect(rows[2].toolArgs).toEqual({ path: "a.txt" });
  });

  it("tolerates legacy plain-string calls (older agents) — no args, no crash", () => {
    const rows = historyToRows([
      { role: "assistant", content: "x", toolCalls: ["website"] },
      { role: "tool", toolName: "website", content: "done" },
    ]);
    expect(rows[1].toolArgs).toBeUndefined();
  });
});

// The engine half is history_wire_tests in services/sontara/src/gateway/rpc.rs.
describe("historyToRows on the shared wire fixture", () => {
  const { messages } = JSON.parse(
    readFileSync(
      new URL("./fixtures/chat-history-wire.json", import.meta.url),
      "utf8"
    )
  );
  const steps = (active: boolean) =>
    historyToRows(messages, { now: NOW, active })
      .filter((r) => r.role === "tool")
      .map((r) => [r.toolStatus, r.content, r.toolArgs]);
  const args = { command: "sleep 1" };

  it("shows quiet, failed and in-flight steps while a turn runs", () => {
    expect(steps(true)).toEqual([
      ["done", "", args],
      ["error", "exit 1", args],
      ["running", "", args],
    ]);
  });

  it("invents no running step when no turn is running", () => {
    expect(steps(false)).toHaveLength(2);
  });

  it("forgets calls an interrupted turn never answered once a new turn starts", () => {
    const rows = historyToRows([...messages, { role: "user", content: "next" }], {
      now: NOW,
      active: true,
    });
    expect(rows.filter((r) => r.toolStatus === "running")).toEqual([]);
  });
});
