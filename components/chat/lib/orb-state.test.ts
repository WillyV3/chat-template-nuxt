import { describe, it, expect } from "vitest";
import {
  orbForTool,
  DEFAULT_ORB,
  ORB_LABELS,
  LISTENING_ORB,
  CONNECTING_ORB,
  WAITING_ORB,
} from "./orb-state";

describe("orbForTool — the orb describes what the agent is DOING", () => {
  it("shows searching for lookups", () => {
    for (const t of ["web_search", "browser_open", "file_read", "list_files"]) {
      expect(orbForTool(t)).toBe("searching");
    }
  });

  // Memory is NOT a search. Pulling threads from several places into one
  // answer is what "weaving" (three strands plaiting) depicts, and separating
  // it from a scan sweep is the whole reason 0.2.0 was worth the exception.
  it("shows weaving for memory and multi-source reads", () => {
    for (const t of ["memory_recall", "memory_store", "read_document", "read_xlsx"]) {
      expect(orbForTool(t)).toBe("weaving");
    }
  });

  it("shows solving for running code", () => {
    for (const t of ["shell", "python_repl", "exec", "bash", "cron_create"]) {
      expect(orbForTool(t)).toBe("solving");
    }
  });

  it("shows composing for producing a document or message", () => {
    for (const t of ["document_create", "file_write", "gmail_send", "google_sheets_append"]) {
      expect(orbForTool(t)).toBe("composing");
    }
  });

  it("shows shaping for making something visual", () => {
    expect(orbForTool("image_generate")).toBe("shaping");
  });

  // The distinction that matters: reading and writing a file are different
  // acts, and the orb must not claim the agent is searching while it writes.
  it("separates file_read from file_write", () => {
    expect(orbForTool("file_read")).toBe("searching");
    expect(orbForTool("file_write")).toBe("composing");
  });

  // MCP tools arrive namespaced; classify on the tool half, not the server.
  it("classifies MCP tools by the tool, not the server name", () => {
    expect(orbForTool("mcp_zapier__web_search")).toBe("searching");
    expect(orbForTool("mcp_github__file_write")).toBe("composing");
  });

  it("is case-insensitive", () => {
    expect(orbForTool("SHELL")).toBe("solving");
  });

  // An unknown tool gets the honest generic, never a guess. Showing
  // "searching" for something that writes a file would be a lie about what is
  // happening on the user's machine.
  it("falls back to the generic orb for unknown tools", () => {
    expect(orbForTool("some_brand_new_tool")).toBe(DEFAULT_ORB);
    expect(orbForTool(undefined)).toBe(DEFAULT_ORB);
    expect(orbForTool("")).toBe(DEFAULT_ORB);
  });
});

describe("the non-tool states", () => {
  // These three exist because 0.2.0 was worth a supply-chain exception: each
  // says something the six-state 0.1.1 set could not.
  it("names the states that are not about a running tool", () => {
    expect(LISTENING_ORB).toBe("listening");
    expect(CONNECTING_ORB).toBe("connecting");
    expect(WAITING_ORB).toBe("breathing");
  });
});

describe("ORB_LABELS — a canvas says nothing to a screen reader", () => {
  it("labels every state the mapping can produce", () => {
    const reachable = [
      DEFAULT_ORB, LISTENING_ORB, CONNECTING_ORB, WAITING_ORB,
      orbForTool("web_search"), orbForTool("shell"),
      orbForTool("document_create"), orbForTool("image_generate"),
      orbForTool("memory_recall"),
    ];
    for (const s of reachable) {
      expect(ORB_LABELS[s], `no label for "${s}"`).toBeTruthy();
    }
  });

  // The audience is non-technical. A label naming the tool would leak
  // implementation at the exact moment the user is waiting and anxious.
  it("uses plain verbs, never tool names", () => {
    const all = Object.values(ORB_LABELS).join(" ").toLowerCase();
    for (const jargon of ["python", "shell", "repl", "api", "mcp", "exec", "tool"]) {
      expect(all).not.toContain(jargon);
    }
  });
});
