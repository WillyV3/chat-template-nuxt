// A zero-key backend that speaks the same gateway protocol the chat room uses
// in production, so the template runs with no server, no account and no model.
//
// The room only needs four members (see GatewayHook in components/chat/lib/use-gateway.ts):
//   rpc("chat.history" | "chat.send" | "chat.abort", params) → Promise
//   on/off("chat" | "agent", handler)                          → event stream
//   connected                                                 → boolean
// To go live, swap this for useGateway(wsUrl, token) (the WebSocket client that
// ships with the room) or any object with the same four members over your own
// transport. Nothing else in the app changes.

import type { HistoryMessage } from "@/components/chat/core/chat-history";

type Handler = (payload: unknown) => void;

export type MockGateway = {
  connected: true;
  rpc: <T = unknown>(method: string, params?: unknown) => Promise<T>;
  on: <T = unknown>(event: string, handler: (payload: T) => void) => void;
  off: <T = unknown>(event: string, handler: (payload: T) => void) => void;
};

export type MockOptions = {
  /** Delay between streamed chunks. */
  tickMs?: number;
  /** The canned reply for a prompt. */
  reply?: (prompt: string) => string;
  /** Seed transcript (what chat.history returns before the first send). */
  history?: HistoryMessage[];
};

export const defaultReply = (prompt: string) =>
  `You said: **${prompt}**\n\nThis reply is streamed by \`lib/mock-gateway.ts\`. ` +
  `Point the room at your own backend by replacing the gateway passed to \`<ChatRoom>\`:\n\n` +
  "```ts\nconst gateway = useGateway(process.env.NEXT_PUBLIC_GATEWAY_URL, token);\n```\n\n" +
  `- Messages render as markdown\n- Tool calls fold into one line above the answer\n- Stop aborts mid-stream`;

export function createMockGateway({ tickMs = 25, reply = defaultReply, history = [] }: MockOptions = {}): MockGateway {
  const listeners = new Map<string, Set<Handler>>();
  const log: HistoryMessage[] = [...history];
  let timers: ReturnType<typeof setTimeout>[] = [];
  let running = false;

  const emit = (event: string, payload: unknown) => listeners.get(event)?.forEach((h) => h(payload));
  const later = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));

  function run(prompt: string) {
    running = true;
    const runId = `run-${Date.now()}`;
    const args = { query: prompt };
    log.push({ role: "assistant", content: "", toolCalls: [{ id: runId, name: "web_search", args }] });
    emit("agent", { type: "tool_call", tool: "web_search", arguments: args });
    later(tickMs * 16, () => {
      const output = `3 results for "${prompt}"`;
      log.push({ role: "tool", content: output, toolName: "web_search", toolCallId: runId, success: true });
      emit("agent", { type: "tool_result", tool: "web_search", output, success: true });

      // Deltas carry the WHOLE text so far, not an increment (the room's contract).
      const words = reply(prompt).split(/(?<=\s)/);
      words.forEach((_, i) =>
        later(tickMs * (i + 1), () =>
          emit("chat", { runId, state: "delta", message: { role: "assistant", content: words.slice(0, i + 1).join("") } }),
        ),
      );
      later(tickMs * (words.length + 1), () => {
        const content = words.join("");
        log.push({ role: "assistant", content, timestamp: Date.now() });
        emit("chat", { runId, state: "final", message: { role: "assistant", content } });
        running = false;
        timers = [];
      });
    });
  }

  return {
    connected: true,
    on: (event, handler) => {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(handler as Handler);
    },
    off: (event, handler) => void listeners.get(event)?.delete(handler as Handler),
    rpc: async <T,>(method: string, params?: unknown): Promise<T> => {
      if (method === "chat.history") return { messages: [...log], active: running } as T;
      if (method === "chat.send") {
        const message = String((params as { message?: string })?.message ?? "");
        log.push({ role: "user", content: message, timestamp: Date.now() });
        if (running) return { status: "queued" } as T; // ponytail: queued sends are acknowledged, not replayed
        run(message);
        return { status: "started" } as T;
      }
      if (method === "chat.abort") {
        timers.forEach(clearTimeout);
        timers = [];
        if (running) emit("chat", { state: "aborted" });
        running = false;
        return undefined as T;
      }
      throw new Error(`mock gateway: unknown method ${method}`);
    },
  };
}
