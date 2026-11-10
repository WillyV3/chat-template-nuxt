import { afterEach, describe, expect, it, vi } from "vitest";

import { downloadAuthed } from "./download";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("downloadAuthed", () => {
  it("clicks an attached anchor and revokes the blob URL only later", async () => {
    vi.useFakeTimers();
    const log: string[] = [];
    const a = { style: {} as Record<string, string>, click: () => log.push("click"), remove: () => log.push("remove") };
    vi.stubGlobal("fetch", async () => new Response("x"));
    vi.stubGlobal("URL", { createObjectURL: () => "blob:1", revokeObjectURL: () => log.push("revoke") });
    vi.stubGlobal("document", { createElement: () => a, body: { appendChild: () => log.push("append") } });

    await downloadAuthed("https://a/api/files/x/download", "t", "x.txt");
    expect(log).toEqual(["append", "click", "remove"]);
    vi.runAllTimers();
    expect(log.at(-1)).toBe("revoke");
  });

  it("throws on a non-OK response", async () => {
    vi.stubGlobal("fetch", async () => new Response("no", { status: 404 }));
    await expect(downloadAuthed("u", "t", "f")).rejects.toThrow("download failed: 404");
  });
});
