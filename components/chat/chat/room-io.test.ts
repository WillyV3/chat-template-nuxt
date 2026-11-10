// The room's IO against a fake gateway you control: history retry, the stream,
// and every send-path hook the ChatRoomConfig declares. The hook in
// use-chat-room.ts only binds these functions to React.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initialChatState } from "@/components/chat/core/chat-model";

import type { GatewayHook } from "../lib/use-gateway";
import type { AttachResult } from "./room-config";
import {
  HISTORY_MAX_ATTEMPTS,
  bindChatStream,
  composeReduce,
  createInitialPromptGate,
  rowsFromHistory,
  routeKey,
  runSend,
  startHistoryLoad,
  activeOrbFor,
  thinkingHidden,
  type AnyAction,
  type AnyRow,
  type RoomPill,
  type SendEnv,
} from "./room-io";

type Handler = (payload: unknown) => void;

function fakeGateway(respond: (method: string, params: Record<string, unknown>) => unknown = () => ({})) {
  const handlers = new Map<string, Set<Handler>>();
  const calls: { method: string; params: Record<string, unknown> }[] = [];
  const rpc = (async (method: string, params?: unknown) => {
    calls.push({ method, params: params as Record<string, unknown> });
    return respond(method, params as Record<string, unknown>);
  }) as GatewayHook["rpc"];
  const on = ((event: string, h: Handler) => {
    if (!handlers.has(event)) handlers.set(event, new Set());
    handlers.get(event)!.add(h);
  }) as GatewayHook["on"];
  const off = ((event: string, h: Handler) => {
    handlers.get(event)?.delete(h);
  }) as GatewayHook["off"];
  return {
    calls,
    rpc,
    on,
    off,
    emit: (event: string, payload: unknown) => handlers.get(event)?.forEach((h) => h(payload)),
    sends: () => calls.filter((c) => c.method === "chat.send"),
  };
}

/** A store the IO functions dispatch into, reduced by composeReduce like the hook does. */
function store(hostReduce?: (s: never, a: never) => never) {
  const reduce = composeReduce<ReturnType<typeof initialChatState<object>>, AnyAction>(hostReduce as never);
  let state = initialChatState({});
  const actions: AnyAction[] = [];
  return {
    get state() {
      return state;
    },
    actions,
    dispatch: (a: AnyAction) => {
      actions.push(a);
      state = reduce(state, a);
    },
  };
}

function env(gw: ReturnType<typeof fakeGateway>, s: ReturnType<typeof store>, send?: SendEnv["send"]): SendEnv {
  return {
    send,
    rpc: gw.rpc,
    dispatch: s.dispatch,
    room: {} as SendEnv["room"],
    timezone: "America/New_York",
    notify: vi.fn(),
    retryMs: 0,
  };
}

const noFiles = { attachments: [], attached: [], composer: true };

describe("state.reduce composes with core's chatReducer", () => {
  it("a host action goes through the host reducer", () => {
    const s = store(((st: object, a: { type: string; ids?: string[] }) =>
      a.type === "citations/received" ? { ...st, citations: a.ids } : st) as never);
    s.dispatch({ type: "citations/received", ids: ["a"] } as never);
    expect((s.state as { citations?: string[] }).citations).toEqual(["a"]);
  });

  it("a core action the host ignores falls through to core", () => {
    const s = store(((st: object) => st) as never);
    s.dispatch({ type: "send/started", message: { id: "u1", role: "user", content: "hi" } });
    expect(s.state.messages.map((m) => m.content)).toEqual(["hi"]);
    expect(s.state.isAgentTyping).toBe(true);
  });
});

describe("history load", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  /** What React does: re-run the load effect each time the attempt counter moves. */
  function runLoadEffect(gw: ReturnType<typeof fakeGateway>, s: ReturnType<typeof store>, parse?: never) {
    let cleanup: (() => void) | undefined;
    let lastAttempt = -1;
    const effect = () => {
      if (s.state.history.loaded || s.state.history.attempt === lastAttempt) return;
      lastAttempt = s.state.history.attempt;
      cleanup?.();
      cleanup = startHistoryLoad({
        rpc: gw.rpc,
        dispatch: (a) => {
          s.dispatch(a);
          effect();
        },
        attempt: s.state.history.attempt,
        parseUserText: parse,
      });
    };
    effect();
    return () => cleanup?.();
  }

  it("retries with a growing delay and loads on the third attempt", async () => {
    let failures = 2;
    const gw = fakeGateway(() => {
      if (failures-- > 0) throw new Error("cold agent");
      return { messages: [{ role: "user", content: "hi", timestamp: 1000 }, { role: "assistant", content: "hello", timestamp: 2000 }] };
    });
    // The host reducer ignores core actions: the fallback is what loads history.
    const s = store(((st: object) => st) as never);
    runLoadEffect(gw, s);

    await vi.advanceTimersByTimeAsync(0);
    expect(gw.calls).toHaveLength(1);
    expect(s.state.history.loaded).toBe(false);

    await vi.advanceTimersByTimeAsync(700); // base * (attempt 0 + 1)
    expect(gw.calls).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1400); // base * (attempt 1 + 1)
    expect(gw.calls).toHaveLength(3);
    await vi.advanceTimersByTimeAsync(0);
    expect(s.state.history.loaded).toBe(true);
    expect(s.state.messages.map((m) => m.content)).toEqual(["hi", "hello"]);
  });

  it("gives up after HISTORY_MAX_ATTEMPTS, latching loaded so the chat opens empty", async () => {
    const gw = fakeGateway(() => {
      throw new Error("down");
    });
    const s = store();
    runLoadEffect(gw, s);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(gw.calls).toHaveLength(HISTORY_MAX_ATTEMPTS + 1);
    expect(s.actions.at(-1)).toEqual({ type: "history/gaveUp" });
    expect(s.state.history.loaded).toBe(true);
  });
});

describe("send path", () => {
  it("a throwing send.before aborts the send and becomes the error row", async () => {
    const gw = fakeGateway();
    const s = store();
    const out = await runSend(
      env(gw, s, {
        before: async () => {
          throw new Error("Pick a case first");
        },
      }),
      { ...noFiles, text: "hello" },
    );
    expect(out.status).toBe("failed");
    expect(gw.sends()).toHaveLength(0);
    // No user bubble; just the error row carrying the thrown message.
    expect(s.state.messages.map((m) => [m.role, m.content])).toEqual([["assistant", "Pick a case first"]]);
  });

  it("transform changes the wire text, never the bubble", async () => {
    const gw = fakeGateway();
    const s = store();
    await (await runSend(env(gw, s, { transform: (t) => `[cases: 1]\n${t}` }), { ...noFiles, text: "hello" })).done;
    expect(gw.sends()[0].params.message).toBe("[cases: 1]\nhello");
    expect(s.state.messages[0].content).toBe("hello");
  });

  it("tagRow lands on the user row and parseUserText rebuilds it from history", async () => {
    const wirePrefix = /^\[cases: (.*)\]\n/;
    const parse = (c: string) => {
      const m = wirePrefix.exec(c);
      return m ? { text: c.slice(m[0].length), extra: { caseIds: m[1].split(",") } } : { text: c };
    };
    const gw = fakeGateway();
    const s = store();
    await (
      await runSend(
        env(gw, s, { transform: (t) => `[cases: 1,2]\n${t}`, tagRow: () => ({ caseIds: ["1", "2"] }) }),
        { ...noFiles, text: "hello" },
      )
    ).done;
    expect(s.state.messages[0]).toMatchObject({ role: "user", content: "hello", caseIds: ["1", "2"] });

    // Reload: the engine returns the wire form; the room restores text + fields.
    const rows = rowsFromHistory(
      { messages: [{ role: "user", content: gw.sends()[0].params.message as string, timestamp: 1 }] },
      parse,
    );
    expect(rows[0]).toMatchObject({ role: "user", content: "hello", caseIds: ["1", "2"] });
  });

  it("attach notes ride the wire text, and attached reaches transform and tagRow", async () => {
    const gw = fakeGateway();
    const s = store();
    const seen: AttachResult[][] = [];
    const attached: AttachResult[] = [
      { label: "a.pdf", path: "Uploads/a.pdf", note: "[uploaded a.pdf as doc 7]", meta: { docId: 7 } },
      { label: "b.pdf", note: "[uploaded b.pdf as doc 8]", meta: { docId: 8 } },
    ];
    await (
      await runSend(
        env(gw, s, {
          transform: (t, ctx) => {
            seen.push(ctx.attached);
            return t;
          },
          tagRow: (ctx) => ({ docs: ctx.attached.map((a) => (a.meta as { docId: number }).docId) }),
        }),
        { text: "read these", attachments: [], attached, composer: true },
      )
    ).done;
    expect(seen[0]).toEqual(attached);
    expect(gw.sends()[0].params.message).toBe("read these\n\n[uploaded a.pdf as doc 7]\n[uploaded b.pdf as doc 8]");
    expect(s.state.messages[0]).toMatchObject({ content: "read these", docs: [7, 8] });
  });

  it("the room's own uploads ride uploadedFiles; in-flight pills are left out", async () => {
    const gw = fakeGateway();
    const s = store();
    const pills: RoomPill[] = [
      { id: "1", label: "x.csv", uploaded: "x.csv" },
      { id: "2", label: "slow.csv", uploading: true },
    ];
    await (await runSend(env(gw, s), { text: "", attachments: [], attached: pills, composer: true })).done;
    expect(gw.sends()[0].params.uploadedFiles).toEqual(["x.csv"]);
    expect(gw.sends()[0].params.message).toBe("I attached 1 file(s) — please take a look.");
    expect(s.state.messages[0].content).toBe("[1 file(s)]");
  });

  it("send.params and the timezone ride every turn; params cannot overwrite the message", async () => {
    const gw = fakeGateway();
    const s = store();
    await (
      await runSend(env(gw, s, { params: () => ({ circleNames: ["Ada"], message: "nope" }) }), {
        ...noFiles,
        text: "hi",
      })
    ).done;
    expect(gw.sends()[0].params).toMatchObject({
      message: "hi",
      sessionKey: "web-chat",
      clientTimezone: "America/New_York",
      circleNames: ["Ada"],
    });
  });

  it("intercept handled = no chat.send and no row; a host-initiated send skips it", async () => {
    const gw = fakeGateway();
    const s = store();
    const intercept = vi.fn(async () => true);
    const e = env(gw, s, { intercept });

    const handled = await runSend(e, { ...noFiles, text: "ask the other agent" });
    expect(handled.status).toBe("handled");
    expect(gw.sends()).toHaveLength(0);
    expect(s.state.messages).toHaveLength(0);
    expect(intercept).toHaveBeenCalledOnce();

    await (await runSend(e, { ...noFiles, text: "from the host", composer: false })).done;
    expect(intercept).toHaveBeenCalledOnce();
    expect(gw.sends()).toHaveLength(1);
  });

  it("intercept returning false falls through to the normal send", async () => {
    const gw = fakeGateway();
    const s = store();
    const out = await runSend(env(gw, s, { intercept: () => false }), { ...noFiles, text: "hi" });
    expect(out.status).toBe("sent");
    await out.done;
    expect(gw.sends()).toHaveLength(1);
  });

  it("a queued reply notifies; a send that fails twice becomes the error row", async () => {
    const queued = fakeGateway(() => ({ status: "queued" }));
    const s1 = store();
    const e1 = env(queued, s1);
    await (await runSend(e1, { ...noFiles, text: "hi" })).done;
    expect(e1.notify).toHaveBeenCalledWith("Your agent is still finishing the last reply. This message is queued.");

    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    const down = fakeGateway(() => {
      throw new Error("socket closed");
    });
    const s2 = store();
    await (await runSend(env(down, s2), { ...noFiles, text: "hi" })).done;
    expect(down.sends()).toHaveLength(2); // the original + the retry
    expect(s2.state.messages.at(-1)?.content).toBe(
      "Couldn't send your message: socket closed. Try again in a moment.",
    );
    vi.restoreAllMocks();
  });
});

describe("voice.onStreamDelta", () => {
  it("gets every delta and then a final call, with cleaned content", () => {
    const gw = fakeGateway();
    const s = store();
    const onDelta = vi.fn();
    const unbind = bindChatStream({ on: gw.on, off: gw.off, dispatch: s.dispatch, onDelta: () => onDelta, now: () => 5 });
    gw.emit("chat", { state: "delta", runId: "r1", message: { role: "assistant", content: "Hel" } });
    gw.emit("chat", { state: "delta", runId: "r1", message: { role: "assistant", content: "Hello." } });
    gw.emit("chat", { state: "final", runId: "r1", message: { role: "assistant", content: "Hello.<memory-context>x</memory-context>" } });
    expect(onDelta.mock.calls).toEqual([
      ["Hel", false],
      ["Hello.", false],
      ["Hello.", true],
    ]);
    expect(s.state.messages.map((m) => [m.content, m.streaming])).toEqual([["Hello.", false]]);
    unbind();
    gw.emit("chat", { state: "delta", message: { role: "assistant", content: "late" } });
    expect(onDelta).toHaveBeenCalledTimes(3);
  });
});

describe("initialPrompt", () => {
  it("is sent once, and only after history has loaded", () => {
    const gate = createInitialPromptGate();
    const send = vi.fn();
    gate(false, "ask on connect", send);
    expect(send).not.toHaveBeenCalled();
    gate(true, "ask on connect", send);
    gate(true, "ask on connect", send);
    gate(true, "something else", send);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith("ask on connect");
  });

  it("does nothing without a prompt", () => {
    const send = vi.fn();
    createInitialPromptGate()(true, undefined, send);
    expect(send).not.toHaveBeenCalled();
  });
});

describe("composer.onKeyDown", () => {
  const key = (k: string, shiftKey = false) => ({ key: k, shiftKey, preventDefault: vi.fn() });

  it("a key the host handles never also sends", () => {
    const submit = vi.fn();
    const e = key("Enter");
    routeKey(() => true, e, submit);
    expect(submit).not.toHaveBeenCalled();
    expect(e.preventDefault).not.toHaveBeenCalled();
  });

  it("Enter sends when the host passes, Shift+Enter is a newline", () => {
    const submit = vi.fn();
    const enter = key("Enter");
    routeKey(() => false, enter, submit);
    expect(submit).toHaveBeenCalledOnce();
    expect(enter.preventDefault).toHaveBeenCalledOnce();
    routeKey(undefined, key("Enter", true), submit);
    routeKey(undefined, key("a"), submit);
    expect(submit).toHaveBeenCalledOnce();
  });
});

describe("what the room shows while the agent works", () => {
  const rows: AnyRow[] = [
    { id: "1", role: "tool", content: "", toolName: "shell", toolStatus: "running" },
    { id: "2", role: "tool", content: "", toolName: "website", toolStatus: "running" },
  ];

  it("voice.state=listening outranks any running tool; otherwise the latest running tool wins", () => {
    const orbFor = (name: string | undefined) => (name === "website" ? "composing" : "searching");
    expect(activeOrbFor(rows, "listening", orbFor as never)).toBe("listening");
    expect(activeOrbFor(rows, "idle", orbFor as never)).toBe("composing");
    expect(activeOrbFor([], undefined, orbFor as never)).toBe("working");
  });

  it("tool.hidesThinking hides the generic thinking row only while that tool runs", () => {
    const hides = (name: string) => name === "website";
    expect(thinkingHidden(rows, hides)).toBe(true);
    expect(thinkingHidden([{ ...rows[1], toolStatus: "done" }], hides)).toBe(false);
    expect(thinkingHidden(rows, undefined)).toBe(false);
  });
});
