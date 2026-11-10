// Pins the contract by compiling a CrimeMiner-shaped host against it: a notice
// role, typed user-row fields, host state + action, a throwing send gate, an
// attach override, and the step-2 seams (composer, intercept, voice.state,
// hidesThinking, setInput/attach on the room). If a field moves, tsc (next
// build) fails here first.
import { describe, expect, it, vi } from "vitest";
import { initialChatState } from "@/components/chat/core/chat-model";
import type { ChatRoomConfig, RoomApi } from "./room-config";
import { RENDERERS } from "./renderers";

type CmRow = { caseIds?: string[] };
type CmState = { citations: string[] };
type CmAction = { type: "citations/received"; ids: string[] };

const cmRoom: ChatRoomConfig<"notice", CmRow, CmState, CmAction> = {
  gateway: { connected: true, rpc: async () => undefined as never, on: () => {}, off: () => {} },
  agent: { url: "https://cm-x.example", token: "t" },
  user: {},
  state: {
    initial: { citations: [] },
    reduce: (s, a) => (a.type === "citations/received" ? { ...s, citations: a.ids } : s),
  },
  renderers: RENDERERS,
  send: {
    before: async ({ text }) => {
      if (!text.trim()) throw new Error("Pick a case first");
    },
    transform: (text) => `[cases: 1]\n${text}`,
    tagRow: () => ({ caseIds: ["1"] }),
    intercept: async (ctx, room) => {
      if (ctx.text.startsWith("/note ")) {
        room.setInput("");
        return true;
      }
      return false;
    },
    canSend: () => true,
  },
  history: { parseUserText: (c) => ({ text: c.replace(/^\[cases: .*\]\n/, ""), extra: { caseIds: ["1"] } }) },
  attach: { onFiles: async (files) => files.map((f) => ({ label: f.name, note: `uploaded ${f.name}`, size: f.size })) },
  composer: {
    onInput: (text, room) => void (text.endsWith("@") && room.setInput(text, { focus: true })),
    onKeyDown: (e) => e.key === "Escape",
    slot: null,
  },
  voice: { state: "idle", controls: null, onStreamDelta: () => {} },
  tool: { hidesThinking: (name) => name === "search_evidence" },
  useHost: (room) => void room.attach({ label: "x" }),
};

describe("ChatRoomConfig", () => {
  it("fits a CrimeMiner-shaped host", async () => {
    const next = cmRoom.state!.reduce(initialChatState(cmRoom.state!.initial), { type: "citations/received", ids: ["a"] });
    expect(next.citations).toEqual(["a"]);
    await expect(cmRoom.send!.before!({ text: " ", attachments: [], attached: [] })).rejects.toThrow("Pick a case first");
  });

  it("the step-2 seams are callable as typed", async () => {
    const setInput = vi.fn();
    const room = { setInput, attach: vi.fn(), input: "" } as unknown as RoomApi<"notice", CmRow, CmState, CmAction>;
    const handled = await cmRoom.send!.intercept!({ text: "/note x", attachments: [], attached: [] }, room);
    expect(handled).toBe(true);
    expect(setInput).toHaveBeenCalledWith("");
    cmRoom.composer!.onInput!("ask @", room);
    expect(setInput).toHaveBeenCalledWith("ask @", { focus: true });
    expect(cmRoom.tool!.hidesThinking!("search_evidence")).toBe(true);
    const files = await cmRoom.attach!.onFiles([new File(["abc"], "a.txt")], room);
    expect(files).toEqual([{ label: "a.txt", note: "uploaded a.txt", size: 3 }]);
  });
});
