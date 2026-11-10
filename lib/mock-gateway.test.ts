// The mock is only useful if the REAL room accepts what it emits, so these drive
// it through the room's own binders and reducer rather than asserting on frames.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { chatReducer, initialChatState, type ChatState } from "@/components/chat/core/chat-model";
import { bindChatStream, bindToolEvents, rowsFromHistory, type AnyAction } from "@/components/chat/chat/room-io";
import { createMockGateway } from "./mock-gateway";

function room(gw = createMockGateway({ tickMs: 1, reply: () => "hello there world" })) {
  let state = initialChatState({}) as ChatState<object, string, object>;
  const dispatch = (a: AnyAction) => (state = chatReducer(state as never, a as never) as typeof state);
  const deltas: string[] = [];
  bindChatStream({ on: gw.on, off: gw.off, dispatch, onDelta: () => (c) => deltas.push(c) });
  bindToolEvents({ on: gw.on, off: gw.off, dispatch });
  return { gw, deltas, get: () => state };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("mock gateway through the room's reducer", () => {
  it("runs a tool, then streams cumulative deltas into one finished assistant row", async () => {
    const r = room();
    await r.gw.rpc("chat.send", { message: "hi" });
    await vi.runAllTimersAsync();

    const rows = r.get().messages;
    expect(rows.map((m) => [m.role, m.toolStatus ?? null])).toEqual([
      ["tool", "done"],
      ["assistant", null],
    ]);
    expect(rows[1]).toMatchObject({ content: "hello there world", streaming: false });
    expect(r.deltas.at(-2)).toBe("hello there world"); // last delta already holds the full text
    expect(r.get().streamingId).toBeNull();
  });

  it("abort stops the stream: no more deltas, the run is closed, the partial text stays", async () => {
    const r = room();
    await r.gw.rpc("chat.send", { message: "hi" });
    await vi.advanceTimersByTimeAsync(18); // tool done, a couple of words in
    await r.gw.rpc("chat.abort");
    const seen = r.deltas.length;
    await vi.runAllTimersAsync();

    expect(r.deltas.length).toBe(seen);
    const partial = r.get().messages.at(-1)!.content;
    expect(partial.length).toBeGreaterThan(0);
    expect(partial).not.toBe("hello there world");
    expect("hello there world".startsWith(partial)).toBe(true);
    expect(r.get().streamingId).toBeNull();
    // ponytail: core's stream/aborted leaves the row's `streaming` flag set (upstream Sontara behavior, kept verbatim).
  });

  it("a send while a run is going is acknowledged as queued", async () => {
    const r = room();
    await r.gw.rpc("chat.send", { message: "one" });
    await expect(r.gw.rpc("chat.send", { message: "two" })).resolves.toEqual({ status: "queued" });
  });

  it("chat.history replays the finished turn as the same rows the live stream built", async () => {
    const r = room();
    await r.gw.rpc("chat.send", { message: "hi" });
    await vi.runAllTimersAsync();

    const reply = await r.gw.rpc<{ messages: never[]; active: boolean }>("chat.history");
    expect(reply.active).toBe(false);
    expect(rowsFromHistory(reply).map((m) => [m.role, m.content, m.toolStatus ?? null])).toEqual([
      ["user", "hi", null],
      ["tool", '3 results for "hi"', "done"],
      ["assistant", "hello there world", null],
    ]);
  });

  it("off() really unsubscribes", async () => {
    const gw = createMockGateway({ tickMs: 1, reply: () => "x" });
    const seen: unknown[] = [];
    const h = (p: unknown) => seen.push(p);
    gw.on("chat", h);
    gw.off("chat", h);
    await gw.rpc("chat.send", { message: "hi" });
    await vi.runAllTimersAsync();
    expect(seen).toEqual([]);
  });

  it("rejects an unknown method loudly", async () => {
    await expect(createMockGateway().rpc("nope")).rejects.toThrow(/unknown method nope/);
  });
});
