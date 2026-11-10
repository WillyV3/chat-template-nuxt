import { describe, expect, it } from "vitest";

import {
  chatReducer,
  initialChatState,
  rewindText,
  type ChatAction,
  type ChatMessage,
  type ChatState,
} from "./chat-model";

// Moved here from apps/web chat/model.test.ts (2026-11-02) with the reducer
// they test; the web file keeps relay / mention / site / picker.

// ─── Fixtures ───────────────────────────────────────────────────────────────

const NOW = 1_700_000_000_000;

const INITIAL = initialChatState({});

function run(actions: ChatAction[], from: ChatState = INITIAL): ChatState {
  return actions.reduce(chatReducer, from);
}

const userRow = (id: string, content: string): ChatMessage => ({
  id,
  role: "user",
  content,
  createdAtMs: NOW,
});

const historyRows: ChatMessage[] = [
  userRow("history-0", "hello"),
  { id: "history-1", role: "assistant", content: "hi", createdAtMs: NOW },
  {
    id: "history-2",
    role: "tool",
    content: "ok",
    toolName: "shell",
    toolStatus: "done",
    createdAtMs: NOW,
  },
];

// ─── Streaming ──────────────────────────────────────────────────────────────

describe("streaming", () => {
  it("first delta opens ONE streaming assistant row and clears typing", () => {
    const s = run([
      { type: "send/started", message: userRow("user-1", "hi") },
      { type: "stream/delta", runId: "run-1", content: "He", now: NOW },
    ]);
    expect(s.isAgentTyping).toBe(false);
    expect(s.streamingId).toBe("run-1");
    expect(s.messages).toHaveLength(2);
    expect(s.messages[1]).toMatchObject({
      id: "run-1",
      role: "assistant",
      content: "He",
      streaming: true,
    });
  });

  it("later deltas REPLACE the content of the same row — no new rows", () => {
    const s = run([
      { type: "stream/delta", runId: "run-1", content: "He", now: NOW },
      { type: "stream/delta", runId: "run-1", content: "Hello", now: NOW + 10 },
      { type: "stream/delta", content: "Hello there", now: NOW + 20 },
    ]);
    expect(s.messages).toHaveLength(1);
    expect(s.messages[0].content).toBe("Hello there");
    expect(s.streamingId).toBe("run-1");
  });

  it("an empty first delta opens nothing, so the answer lands AFTER its tool rows", () => {
    const s = run([
      { type: "send/started", message: userRow("user-1", "hi") },
      { type: "stream/delta", runId: "run-1", content: "", now: NOW },
      { type: "tool/called", id: "tool-1", toolName: "shell", now: NOW + 5 },
      { type: "stream/delta", runId: "run-1", content: "Done", now: NOW + 10 },
    ]);
    expect(s.messages.map((m) => m.role)).toEqual(["user", "tool", "assistant"]);
    expect(s.messages[2]).toMatchObject({ content: "Done", streaming: true });
  });

  it("delta without a runId mints msg-<now> as the stream id", () => {
    const s = run([{ type: "stream/delta", content: "x", now: NOW }]);
    expect(s.streamingId).toBe(`msg-${NOW}`);
  });

  it("final closes the stream in place with the full content", () => {
    const s = run([
      { type: "stream/delta", runId: "run-1", content: "Hel", now: NOW },
      { type: "stream/final", runId: "run-1", content: "Hello.", now: NOW + 50 },
    ]);
    expect(s.streamingId).toBeNull();
    expect(s.isAgentTyping).toBe(false);
    expect(s.messages).toHaveLength(1);
    expect(s.messages[0]).toMatchObject({ content: "Hello.", streaming: false });
  });

  it("final with no open stream appends a fresh assistant row", () => {
    const s = run([
      { type: "send/started", message: userRow("user-1", "hi") },
      { type: "stream/final", runId: "run-9", content: "Done.", now: NOW },
    ]);
    expect(s.messages).toHaveLength(2);
    expect(s.messages[1]).toMatchObject({ id: "run-9", role: "assistant", content: "Done." });
    expect(s.isAgentTyping).toBe(false);
  });

  it("error appends an err row and resets streaming + typing", () => {
    const s = run([
      { type: "stream/delta", runId: "run-1", content: "Hel", now: NOW },
      { type: "stream/error", content: "boom", now: NOW + 1 },
    ]);
    expect(s.streamingId).toBeNull();
    expect(s.isAgentTyping).toBe(false);
    expect(s.messages[1]).toMatchObject({ id: `err-${NOW + 1}`, role: "assistant", content: "boom" });
  });

  it("aborted resets streaming + typing and appends nothing", () => {
    const s = run([
      { type: "stream/delta", runId: "run-1", content: "Hel", now: NOW },
      { type: "stream/aborted" },
    ]);
    expect(s.streamingId).toBeNull();
    expect(s.isAgentTyping).toBe(false);
    expect(s.messages).toHaveLength(1); // the partial row stays as-is
  });
});

// ─── Tool lifecycle ─────────────────────────────────────────────────────────

describe("tool lifecycle", () => {
  const called: ChatAction = {
    type: "tool/called",
    id: "tool-1",
    toolName: "shell",
    args: { command: "ls" },
    now: NOW,
  };

  it("tool/called appends a running row with args", () => {
    const s = run([called]);
    expect(s.messages[0]).toMatchObject({
      id: "tool-1",
      role: "tool",
      toolName: "shell",
      toolStatus: "running",
      toolArgs: { command: "ls" },
      content: "",
    });
  });

  it("tool/resolved updates the running row in place and measures duration", () => {
    const s = run([
      called,
      { type: "tool/resolved", toolName: "shell", output: "file.txt", isError: false, orphanId: "toolres-x", now: NOW + 1234 },
    ]);
    expect(s.messages).toHaveLength(1);
    expect(s.messages[0]).toMatchObject({
      toolStatus: "done",
      content: "file.txt",
      toolDurationMs: 1234,
    });
  });

  it("a failed result marks the row error", () => {
    const s = run([
      called,
      { type: "tool/resolved", toolName: "shell", output: "no such file", isError: true, orphanId: "toolres-x", now: NOW + 10 },
    ]);
    expect(s.messages[0].toolStatus).toBe("error");
  });

  it("resolves the MOST RECENT running row when the same tool runs twice", () => {
    const s = run([
      called,
      { type: "tool/called", id: "tool-2", toolName: "shell", now: NOW + 5 },
      { type: "tool/resolved", toolName: "shell", output: "second", isError: false, orphanId: "toolres-x", now: NOW + 20 },
    ]);
    expect(s.messages[0].toolStatus).toBe("running"); // first untouched
    expect(s.messages[1]).toMatchObject({ id: "tool-2", toolStatus: "done", content: "second" });
  });

  it("does not touch running rows of OTHER tools", () => {
    const s = run([
      called,
      { type: "tool/called", id: "tool-2", toolName: "file_read", now: NOW + 5 },
      { type: "tool/resolved", toolName: "shell", output: "ok", isError: false, orphanId: "toolres-x", now: NOW + 20 },
    ]);
    expect(s.messages[0].toolStatus).toBe("done");
    expect(s.messages[1].toolStatus).toBe("running");
  });

  it("an orphaned result appends a row under orphanId", () => {
    const s = run([
      { type: "tool/resolved", toolName: "shell", output: "late", isError: false, orphanId: "toolres-9", now: NOW },
    ]);
    expect(s.messages[0]).toMatchObject({ id: "toolres-9", role: "tool", toolStatus: "done", content: "late" });
    expect(s.messages[0].toolDurationMs).toBeUndefined();
  });
});

// ─── Optimistic send + reconcile ────────────────────────────────────────────

describe("optimistic send + reconcile", () => {
  it("send/started appends the user row and turns typing on", () => {
    const s = run([{ type: "send/started", message: userRow("user-1", "hi") }]);
    expect(s.messages).toEqual([userRow("user-1", "hi")]);
    expect(s.isAgentTyping).toBe(true);
  });

  it("send/failed appends the error row and turns typing off", () => {
    const err: ChatMessage = { id: "err-1", role: "assistant", content: "Couldn't send", createdAtMs: NOW };
    const s = run([
      { type: "send/started", message: userRow("user-1", "hi") },
      { type: "send/failed", errorRow: err },
    ]);
    expect(s.isAgentTyping).toBe(false);
    expect(s.messages[1]).toEqual(err);
  });

  it("send/failed without a row (voice path) only clears typing", () => {
    const s = run([
      { type: "send/started", message: userRow("user-1", "hi") },
      { type: "send/failed" },
    ]);
    expect(s.isAgentTyping).toBe(false);
    expect(s.messages).toHaveLength(1);
  });

  it("opening the chat mid-turn shows the run as live until it ends", () => {
    const rows = [{ id: "r", role: "tool" as const, content: "", toolName: "shell", toolStatus: "running" as const, createdAtMs: 0 }];
    const joined = run([{ type: "history/loaded", rows, omittedCount: 0, active: true }]);
    expect(joined.isAgentTyping).toBe(true);
    expect(joined.history.joinedRun).toBe(true);

    const ended = chatReducer(joined, { type: "stream/final", content: "done", now: 1 });
    expect(ended.isAgentTyping).toBe(false);
    expect(ended.history.joinedRun).toBe(true); // polling on: the record corrects a failed tool
    expect(ended.messages[0].toolStatus).toBe("done");
  });

  it("a resync that finds no running turn ends a run whose final was missed", () => {
    const joined = run([{ type: "history/loaded", rows: [], omittedCount: 0, active: true }]);
    const s = chatReducer(joined, { type: "history/resynced", rows: [], omittedCount: 0, active: false });
    expect(s.isAgentTyping).toBe(false);
    expect(s.history.joinedRun).toBe(false);
  });

  it("history/loaded replaces the transcript and latches loaded", () => {
    const s = run([{ type: "history/loaded", rows: historyRows, omittedCount: 7, active: false }]);
    expect(s.messages).toEqual(historyRows);
    expect(s.omittedCount).toBe(7);
    expect(s.history.loaded).toBe(true);
  });

  it("resync replaces messages but CARRIES a live streaming row", () => {
    const s = run([
      { type: "history/loaded", rows: [], omittedCount: 0, active: false },
      { type: "send/started", message: userRow("user-1", "hi") },
      { type: "stream/delta", runId: "run-1", content: "partial", now: NOW },
      { type: "history/resynced", rows: historyRows, omittedCount: 2, active: false },
    ]);
    expect(s.messages).toHaveLength(historyRows.length + 1);
    expect(s.messages.at(-1)).toMatchObject({ id: "run-1", streaming: true, content: "partial" });
    expect(s.omittedCount).toBe(2);
    // Something is still streaming on the new socket — typing state untouched.
    expect(s.isAgentTyping).toBe(false); // (delta already cleared it)
  });

  it("resync with nothing streaming clears the stale typing indicator", () => {
    const s = run([
      { type: "send/started", message: userRow("user-1", "hi") },
      { type: "history/resynced", rows: historyRows, omittedCount: 0, active: false },
    ]);
    expect(s.isAgentTyping).toBe(false);
    expect(s.messages).toEqual(historyRows);
  });

  it("history retry: attemptBumped increments, gaveUp latches loaded", () => {
    const s = run([{ type: "history/attemptBumped" }, { type: "history/attemptBumped" }]);
    expect(s.history.attempt).toBe(2);
    expect(s.history.loaded).toBe(false);
    const gaveUp = chatReducer(s, { type: "history/gaveUp" });
    expect(gaveUp.history.loaded).toBe(true);
  });
});
// ─── rewindText ─────────────────────────────────────────────────────────────

describe("rewindText", () => {
  const msgs: ChatMessage[] = [
    userRow("u1", "first question"),
    { id: "a1", role: "assistant", content: "answer", createdAtMs: NOW },
    { id: "t1", role: "tool", content: "out", toolName: "shell", toolStatus: "done" },
    { id: "a2", role: "assistant", content: "more", createdAtMs: NOW },
  ];

  it("a user message rewinds to its own text", () => {
    expect(rewindText(msgs, "u1")).toBe("first question");
  });

  it("an assistant message rewinds to the preceding user prompt", () => {
    expect(rewindText(msgs, "a2")).toBe("first question");
  });

  it("unknown id or no preceding user message yields empty", () => {
    expect(rewindText(msgs, "nope")).toBe("");
    expect(rewindText([{ id: "a1", role: "assistant", content: "x" }], "a1")).toBe("");
  });
});


// ─── message/patched ────────────────────────────────────────────────────────

describe("message/patched", () => {
  it("merges the patch into the row with that id and leaves the others alone", () => {
    const s = run([
      { type: "message/appended", message: userRow("u1", "hi") },
      { type: "message/appended", message: { id: "a1", role: "assistant", content: "x" } },
      { type: "message/patched", id: "a1", patch: { content: "xyz", streaming: true } },
    ]);
    expect(s.messages[0]).toEqual(userRow("u1", "hi"));
    expect(s.messages[1]).toEqual({ id: "a1", role: "assistant", content: "xyz", streaming: true });
  });

  it("an unknown id is a no-op that returns the same state object", () => {
    const before = run([{ type: "message/appended", message: userRow("u1", "hi") }]);
    const after = chatReducer(before, {
      type: "message/patched",
      id: "nope",
      patch: { content: "changed" },
    });
    expect(after).toBe(before);
  });

  it("does not touch the typing or streaming state", () => {
    const before = run([
      { type: "send/started", message: userRow("u1", "hi") },
      { type: "stream/delta", runId: "run-1", content: "He", now: NOW },
    ]);
    const after = chatReducer(before, { type: "message/patched", id: "u1", patch: { content: "edited" } });
    expect(after.streamingId).toBe("run-1");
    expect(after.messages[0].content).toBe("edited");
  });
});

// ─── message/appended ───────────────────────────────────────────────────────

describe("message/appended", () => {
  it("appends without touching typing", () => {
    const s = run([{ type: "message/appended", message: userRow("u1", "hi") }]);
    expect(s.messages).toEqual([userRow("u1", "hi")]);
    expect(s.isAgentTyping).toBe(false);
  });
});

// ─── Optional `active` (3 states: true running, false ended, missing unknown) ─

describe("history/loaded with a missing `active`", () => {
  const rows = [userRow("u1", "hi")];

  it("never claims a run ended: typing and joinedRun keep what they were", () => {
    const joined = run([{ type: "history/loaded", rows, omittedCount: 0, active: true }]);
    expect(joined.isAgentTyping).toBe(true);
    expect(joined.history.joinedRun).toBe(true);

    // A second load that does not know leaves the live run live.
    const again = chatReducer(joined, { type: "history/loaded", rows, omittedCount: 3 });
    expect(again.isAgentTyping).toBe(true);
    expect(again.history.joinedRun).toBe(true);
    expect(again.omittedCount).toBe(3);
    expect(again.history.loaded).toBe(true);
  });

  it("from a quiet state it starts nothing", () => {
    const s = run([{ type: "history/loaded", rows, omittedCount: 0 }]);
    expect(s.isAgentTyping).toBe(false);
    expect(s.history.joinedRun).toBe(false);
    expect(s.messages).toEqual(rows);
    expect(s.history.loaded).toBe(true);
  });

  it("an explicit false still means ended", () => {
    const joined = run([{ type: "history/loaded", rows, omittedCount: 0, active: true }]);
    const ended = chatReducer(joined, { type: "history/loaded", rows, omittedCount: 0, active: false });
    expect(ended.history.joinedRun).toBe(false);
    // typing is only ever turned ON by a load, as before
    expect(ended.isAgentTyping).toBe(true);
  });
});

describe("history/resynced with a missing `active`", () => {
  const rows = [userRow("u1", "hi")];

  it("with nothing streaming, clears the typing state and joinedRun", () => {
    const joined = run([{ type: "history/loaded", rows, omittedCount: 0, active: true }]);
    expect(joined.isAgentTyping).toBe(true);
    const s = chatReducer(joined, { type: "history/resynced", rows, omittedCount: 0 });
    expect(s.isAgentTyping).toBe(false);
    expect(s.history.joinedRun).toBe(false);
  });

  it("clears a stale typing indicator after a send, like active: false", () => {
    const s = run([
      { type: "send/started", message: userRow("u1", "hi") },
      { type: "history/resynced", rows, omittedCount: 0 },
    ]);
    expect(s.isAgentTyping).toBe(false);
  });

  it("with a message streaming on the socket, leaves the typing state alone", () => {
    const streaming = run([
      { type: "send/started", message: userRow("u1", "hi") },
      { type: "stream/delta", runId: "run-1", content: "par", now: NOW },
    ]);
    const s = chatReducer(streaming, { type: "history/resynced", rows, omittedCount: 0 });
    expect(s.isAgentTyping).toBe(streaming.isAgentTyping);
    expect(s.messages.at(-1)).toMatchObject({ id: "run-1", streaming: true });
  });

  it("an explicit true still starts the typing state when nothing streams", () => {
    const s = run([{ type: "history/resynced", rows, omittedCount: 0, active: true }]);
    expect(s.isAgentTyping).toBe(true);
    expect(s.history.joinedRun).toBe(true);
  });
});

// ─── Generics: host fields and host roles ───────────────────────────────────

describe("generic hosts", () => {
  it("initialChatState carries the host's extra fields and the reducer preserves them", () => {
    const start = initialChatState({ pendingHitl: null as string | null });
    const s = chatReducer(start, { type: "send/started", message: userRow("u1", "hi") });
    expect(s.pendingHitl).toBeNull();
    expect(s.messages).toHaveLength(1);
  });

  it("a host role rides through the reducer unchanged", () => {
    type Row = ChatMessage<"hitl">;
    const hitl: Row = { id: "h1", role: "hitl", content: "approve?" };
    const start = initialChatState({});
    const s = chatReducer<object, "hitl">(start, { type: "message/appended", message: hitl });
    expect(s.messages[0].role).toBe("hitl");
    const patched = chatReducer<object, "hitl">(s, {
      type: "message/patched",
      id: "h1",
      patch: { content: "approved" },
    });
    expect(patched.messages[0]).toEqual({ id: "h1", role: "hitl", content: "approved" });
  });

  it("a run ending settles tool rows but leaves host-role rows alone", () => {
    const hitl: ChatMessage<"hitl"> = { id: "h1", role: "hitl", content: "approve?", toolStatus: "running" };
    const s = [
      { type: "message/appended", message: hitl },
      { type: "tool/called", id: "t1", toolName: "shell", now: NOW },
      { type: "stream/aborted" },
    ] satisfies ChatAction<"hitl">[];
    const end = s.reduce(
      (st, a) => chatReducer<object, "hitl">(st, a),
      initialChatState({}) as ChatState<object, "hitl">
    );
    expect(end.messages[0].toolStatus).toBe("running");
    expect(end.messages[1].toolStatus).toBe("done");
  });
});

// ─── settle on run end ──────────────────────────────────────────────────────

describe("a run ending settles still-running tool rows", () => {
  const called: ChatAction = { type: "tool/called", id: "t1", toolName: "shell", now: NOW };

  it.each<ChatAction>([
    { type: "stream/final", content: "done", now: NOW + 1 },
    { type: "stream/error", content: "boom", now: NOW + 1 },
    { type: "stream/aborted" },
  ])("%o", (end) => {
    const s = run([called, end]);
    expect(s.messages[0].toolStatus).toBe("done");
  });

  it("other actions do not settle", () => {
    const s = run([called, { type: "history/gaveUp" }]);
    expect(s.messages[0].toolStatus).toBe("running");
  });
});

// ─── host-declared row fields (RowExtra) ────────────────────────────────────

describe("a host declares its own optional fields on rows", () => {
  type Fields = { citations?: string[]; caseId?: string };
  type HostRow = ChatMessage<"notice", Fields>;
  type HostAction = ChatAction<"notice", Fields>;
  type HostState = ChatState<object, "notice", Fields>;

  const host = (actions: HostAction[]): HostState =>
    actions.reduce(
      (st, a) => chatReducer<object, "notice", Fields>(st, a),
      initialChatState({}) as HostState
    );

  it("patches, reads back, and accepts the host role", () => {
    const notice: HostRow = { id: "n1", role: "notice", content: "hi", caseId: "c-9" };
    const s = host([
      { type: "message/appended", message: notice },
      { type: "message/patched", id: "n1", patch: { citations: ["a", "b"] } },
    ]);
    expect(s.messages[0].caseId).toBe("c-9");
    expect(s.messages[0].citations).toEqual(["a", "b"]);
    expect(s.messages[0].role).toBe("notice");
  });

  it("rejects an undeclared field", () => {
    const patch: HostAction = {
      type: "message/patched",
      id: "n1",
      // @ts-expect-error an undeclared field is still rejected
      patch: { nope: 1 },
    };
    expect(patch.type).toBe("message/patched");
  });
});
