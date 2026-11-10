import { describe, expect, it } from "vitest";
import {
  bodyParts,
  filterRoster,
  partitionRoster,
  appendSent,
  dayLabel,
  freshCount,
  groupByDay,
  isUnread,
  rosterRows,
  rowTime,
} from "./logic";
import type { ConversationSummaryRow, Peer, ThreadMessage } from "./types";

const NOW = new Date("2026-08-26T18:00:00Z");

const conv = (over: Partial<ConversationSummaryRow> & { person_id: string }): ConversationSummaryRow => ({
  last_id: `m-${over.person_id}`,
  last_body: "hey",
  last_at: "2026-08-26T17:00:00Z",
  last_from_me: false,
  ...over,
});

const msg = (id: string, at: string, sender = "them"): ThreadMessage => ({
  id, sender_id: sender, body: `b-${id}`, created_at: at,
});

describe("rosterRows", () => {
  const ada = { id: "u_ada", name: "Ada" };
  const bob = { id: "u_bob", name: "Bob" };

  it("members lead with the org lane; circle follows with peer", () => {
    const rows = rosterRows([ada], [bob], []);
    expect(rows).toEqual([
      { peer: ada, lane: "org" },
      { peer: bob, lane: "peer" },
    ]);
  });

  it("a person in BOTH pools appears once, on the org lane", () => {
    const rows = rosterRows([ada], [ada, bob], []);
    expect(rows.filter((r) => r.peer.id === "u_ada")).toEqual([{ peer: ada, lane: "org" }]);
  });

  it("history with a disconnected person stays reachable as Former connection", () => {
    const rows = rosterRows([], [bob], [conv({ person_id: "u_gone" })]);
    expect(rows.at(-1)).toEqual({
      peer: { id: "u_gone", name: "Former connection" },
      lane: "peer",
    });
  });

  it("a conversation with a known person adds no duplicate row", () => {
    const rows = rosterRows([ada], [], [conv({ person_id: "u_ada" })]);
    expect(rows).toHaveLength(1);
  });
});

describe("unread + badge", () => {
  it("their latest message, unopened → unread; opened or mine → not", () => {
    const c = conv({ person_id: "p" });
    expect(isUnread(c, new Set())).toBe(true);
    expect(isUnread(c, new Set([c.last_id]))).toBe(false);
    expect(isUnread(conv({ person_id: "p", last_from_me: true }), new Set())).toBe(false);
    expect(isUnread(undefined, new Set())).toBe(false);
  });

  it("badge counts only arrivals after the panel was last opened", () => {
    const early = conv({ person_id: "a", last_at: "2026-08-26T10:00:00Z" });
    const late = conv({ person_id: "b", last_at: "2026-08-26T17:00:00Z" });
    const seenAt = new Date("2026-08-26T12:00:00Z").getTime();
    expect(freshCount([early, late], new Set(), seenAt)).toBe(1);
    // ...and an unread you already opened never counts, however fresh.
    expect(freshCount([late], new Set([late.last_id]), seenAt)).toBe(0);
  });

  it("muted/archived people never ring the badge, however fresh", () => {
    const late = conv({ person_id: "b", last_at: "2026-08-26T17:00:00Z" });
    expect(freshCount([late], new Set(), 0, new Set(["b"]))).toBe(0);
    expect(freshCount([late], new Set(), 0, new Set(["other"]))).toBe(1);
  });
});

describe("partitionRoster + filterRoster", () => {
  const rows = [
    { peer: { id: "a", name: "Ada Lovelace" }, lane: "peer" as const },
    { peer: { id: "b", name: "Bob" }, lane: "org" as const },
  ];

  it("splits archived onto the shelf, order preserved", () => {
    const { active, archived } = partitionRoster(rows, new Set(["b"]));
    expect(active.map((r) => r.peer.id)).toEqual(["a"]);
    expect(archived.map((r) => r.peer.id)).toEqual(["b"]);
  });

  it("empty archive set keeps everyone active", () => {
    expect(partitionRoster(rows, new Set()).archived).toEqual([]);
  });

  it("filters by case-insensitive name substring; empty term = everyone", () => {
    expect(filterRoster(rows, "love").map((r) => r.peer.id)).toEqual(["a"]);
    expect(filterRoster(rows, "  ")).toEqual(rows);
    expect(filterRoster(rows, "zzz")).toEqual([]);
  });
});

describe("appendSent", () => {
  it("appends a new message, dedupes one the poll already delivered", () => {
    const a = msg("1", "2026-08-26T17:00:00Z");
    const b = msg("2", "2026-08-26T17:01:00Z");
    expect(appendSent([a], b).map((m) => m.id)).toEqual(["1", "2"]);
    expect(appendSent([a, b], b).map((m) => m.id)).toEqual(["1", "2"]);
  });
});

describe("day grouping", () => {
  it("labels today, yesterday, and dated days (year only when different)", () => {
    expect(dayLabel("2026-08-26T09:00:00Z", NOW)).toBe("Today");
    expect(dayLabel("2026-08-25T23:00:00Z", NOW)).toBe("Yesterday");
    expect(dayLabel("2026-08-12T09:00:00Z", NOW)).toMatch(/Aug 12/);
    expect(dayLabel("2025-08-12T09:00:00Z", NOW)).toMatch(/2025/);
  });

  it("splits a thread into ordered day groups", () => {
    const groups = groupByDay(
      [
        msg("1", "2026-08-24T10:00:00Z"),
        msg("2", "2026-08-24T11:00:00Z"),
        msg("3", "2026-08-26T09:00:00Z"),
      ],
      NOW,
    );
    expect(groups.map((g) => [g.label, g.messages.length])).toEqual([
      [dayLabel("2026-08-24T10:00:00Z", NOW), 2],
      ["Today", 1],
    ]);
  });

  it("an empty thread groups to nothing", () => {
    expect(groupByDay([], NOW)).toEqual([]);
  });
});

describe("bodyParts", () => {
  it("plain text stays one text part", () => {
    expect(bodyParts("hello there")).toEqual([{ kind: "text", value: "hello there" }]);
  });

  it("splits links out in order, text around them intact", () => {
    expect(bodyParts("see https://a.com and http://b.io/x?q=1 ok")).toEqual([
      { kind: "text", value: "see " },
      { kind: "link", value: "https://a.com" },
      { kind: "text", value: " and " },
      { kind: "link", value: "http://b.io/x?q=1" },
      { kind: "text", value: " ok" },
    ]);
  });

  it("trailing sentence punctuation stays text, not address", () => {
    expect(bodyParts("read https://x.com/docs.")).toEqual([
      { kind: "text", value: "read " },
      { kind: "link", value: "https://x.com/docs" },
      { kind: "text", value: "." },
    ]);
  });

  it("non-http schemes are not linkified", () => {
    expect(bodyParts("run javascript:alert(1) now")).toEqual([
      { kind: "text", value: "run javascript:alert(1) now" },
    ]);
  });

  it("a bare link is one link part", () => {
    expect(bodyParts("https://sontara.ai")).toEqual([{ kind: "link", value: "https://sontara.ai" }]);
  });
});

describe("rowTime", () => {
  it("scales now → minutes → hours → weekday → date", () => {
    expect(rowTime("2026-08-26T17:59:40Z", NOW)).toBe("now");
    expect(rowTime("2026-08-26T17:45:00Z", NOW)).toBe("15m");
    expect(rowTime("2026-08-26T14:00:00Z", NOW)).toBe("4h");
    expect(rowTime("2026-08-24T14:00:00Z", NOW)).toMatch(/^[A-Z][a-z]{2}$/); // "Mon"
    expect(rowTime("2026-08-01T14:00:00Z", NOW)).toMatch(/Aug 1/);
  });
});
