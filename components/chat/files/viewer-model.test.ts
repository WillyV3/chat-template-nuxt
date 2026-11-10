import { describe, it, expect } from "vitest";

import {
  classifyFile,
  capSheetRows,
  cellDisplay,
  describeFileType,
  jsonNodeSummary,
  parseJsonDocument,
  resolveLang,
  CONVERTIBLE_EXTS,
  PREVIEW_FAILED_HINT,
  SHEET_ROW_CAP,
} from "./viewer-model";

describe("parseJsonDocument", () => {
  it("parses plain json and returns undefined on garbage", () => {
    expect(parseJsonDocument('{"a":1}', "x.json")).toEqual({ a: 1 });
    expect(parseJsonDocument("not json", "x.json")).toBeUndefined();
  });

  it("parses jsonl line-by-line into an array, skipping blank lines", () => {
    expect(parseJsonDocument('{"a":1}\n\n{"b":2}\n', "log.jsonl")).toEqual([
      { a: 1 },
      { b: 2 },
    ]);
    expect(parseJsonDocument('{"a":1}\nbroken', "log.jsonl")).toBeUndefined();
    expect(parseJsonDocument("", "log.jsonl")).toBeUndefined();
  });

  it("json null parses to null, which is distinct from unparseable", () => {
    expect(parseJsonDocument("null", "x.json")).toBeNull();
  });

  it("summarizes collapsed nodes in plain language", () => {
    expect(jsonNodeSummary([1])).toBe("1 item");
    expect(jsonNodeSummary([1, 2, 3])).toBe("3 items");
    expect(jsonNodeSummary({ a: 1 })).toBe("1 field");
    expect(jsonNodeSummary({ a: 1, b: 2 })).toBe("2 fields");
  });
});

describe("classifyFile", () => {
  it("routes video by extension and by mime", () => {
    expect(classifyFile("clip.mp4", "")).toBe("video");
    expect(classifyFile("clip.webm", "")).toBe("video");
    expect(classifyFile("clip.mov", "video/quicktime")).toBe("video");
    expect(classifyFile("clip.m4v", "")).toBe("video");
    expect(classifyFile("weird-name.bin", "video/mp4")).toBe("video");
  });

  it("routes audio by extension and by mime", () => {
    for (const ext of ["mp3", "wav", "m4a", "ogg", "flac"]) {
      expect(classifyFile(`song.${ext}`, "")).toBe("audio");
    }
    expect(classifyFile("song.bin", "audio/mpeg")).toBe("audio");
  });

  it("routes docx to the client-side renderer kind", () => {
    expect(classifyFile("report.docx", "")).toBe("docx");
    expect(
      classifyFile(
        "report.docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      )
    ).toBe("docx");
  });

  it("routes xlsx to sheet; legacy xls stays a download card", () => {
    expect(classifyFile("budget.xlsx", "")).toBe("sheet");
    expect(
      classifyFile(
        "budget.xlsx",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      )
    ).toBe("sheet");
    expect(classifyFile("budget.xls", "")).toBe("binary");
    expect(classifyFile("budget.xls", "application/vnd.ms-excel")).toBe("binary");
  });

  it("keeps presentations, legacy word, archives and Apple formats on the card", () => {
    for (const ext of ["pptx", "ppt", "doc", "odt", "ods", "odp", "rtf", "zip", "pages", "numbers", "key"]) {
      expect(classifyFile(`f.${ext}`, "")).toBe("binary");
    }
  });

  it("treats HEIC/HEIF as un-renderable even with an image/* mime", () => {
    expect(classifyFile("IMG_0001.heic", "")).toBe("binary");
    expect(classifyFile("IMG_0001.heic", "image/heic")).toBe("binary");
    expect(classifyFile("IMG_0002.heif", "image/heif")).toBe("binary");
  });

  it("disambiguates .key: text mime = an actual key file, not Keynote", () => {
    expect(classifyFile("server.key", "text/plain")).toBe("text");
    expect(classifyFile("deck.key", "")).toBe("binary");
    expect(classifyFile("deck.key", "application/octet-stream")).toBe("binary");
  });

  it("renders .txt as a note, .log as mono code, unknown text as a note", () => {
    expect(classifyFile("todo.txt", "text/plain")).toBe("note");
    expect(classifyFile("todo.txt", "")).toBe("note");
    expect(classifyFile("server.log", "")).toBe("code"); // shiki "log" grammar
    expect(classifyFile("mystery.xyz", "")).toBe("note");
    expect(classifyFile("LICENSE", "")).toBe("note");
  });

  it("keeps the pre-existing kinds stable", () => {
    expect(classifyFile("photo.png", "image/png")).toBe("image");
    expect(classifyFile("doc.pdf", "application/pdf")).toBe("pdf");
    expect(classifyFile("notes.md", "")).toBe("markdown");
    expect(classifyFile("page.html", "")).toBe("html");
    expect(classifyFile("data.json", "")).toBe("json");
    expect(classifyFile("data.csv", "")).toBe("csv");
    expect(classifyFile("main.py", "")).toBe("code");
    expect(classifyFile("main.rs", "")).toBe("code");
  });

  it("resolves aliased and direct shiki grammar ids", () => {
    expect(resolveLang("ts")).toBe("typescript");
    expect(resolveLang("go")).toBe("go");
    expect(resolveLang("nope-not-a-lang")).toBeNull();
  });

  it("only marks server-convertible extensions for the /api/preview round-trip", () => {
    expect([...CONVERTIBLE_EXTS].sort()).toEqual(
      ["doc", "odp", "ods", "odt", "ppt", "pptx", "rtf", "xls"].sort()
    );
    expect(CONVERTIBLE_EXTS.has("zip")).toBe(false);
    expect(CONVERTIBLE_EXTS.has("heic")).toBe(false);
    expect(CONVERTIBLE_EXTS.has("docx")).toBe(false); // client-side now
    expect(CONVERTIBLE_EXTS.has("xlsx")).toBe(false); // client-side now
  });
});

describe("capSheetRows", () => {
  it("shows everything under the cap", () => {
    expect(capSheetRows(0)).toEqual({ shown: 0, truncated: false });
    expect(capSheetRows(999)).toEqual({ shown: 999, truncated: false });
    expect(capSheetRows(SHEET_ROW_CAP)).toEqual({
      shown: SHEET_ROW_CAP,
      truncated: false,
    });
  });

  it("caps and flags truncation above the cap", () => {
    expect(capSheetRows(SHEET_ROW_CAP + 1)).toEqual({
      shown: SHEET_ROW_CAP,
      truncated: true,
    });
    expect(capSheetRows(100_000)).toEqual({
      shown: SHEET_ROW_CAP,
      truncated: true,
    });
  });

  it("never goes negative and respects a custom cap", () => {
    expect(capSheetRows(-5)).toEqual({ shown: 0, truncated: false });
    expect(capSheetRows(10, 3)).toEqual({ shown: 3, truncated: true });
  });
});

describe("cellDisplay", () => {
  it("renders primitives and empties", () => {
    expect(cellDisplay(null)).toBe("");
    expect(cellDisplay(undefined)).toBe("");
    expect(cellDisplay("hello")).toBe("hello");
    expect(cellDisplay(42.5)).toBe("42.5");
    expect(cellDisplay(true)).toBe("true");
  });

  it("shows a formula's computed result, never the formula", () => {
    expect(cellDisplay({ formula: "A1+B1", result: 3 })).toBe("3");
    expect(cellDisplay({ sharedFormula: "A1", result: "ok" })).toBe("ok");
    expect(cellDisplay({ formula: "A1+B1" })).toBe(""); // uncached → blank, not "=A1+B1"
  });

  it("flattens rich text and hyperlink cells", () => {
    expect(
      cellDisplay({ richText: [{ text: "Hello " }, { text: "world" }] })
    ).toBe("Hello world");
    expect(
      cellDisplay({ text: "Sontara", hyperlink: "https://sontara.ai" })
    ).toBe("Sontara");
    expect(cellDisplay({ hyperlink: "https://sontara.ai" })).toBe(
      "https://sontara.ai"
    );
  });

  it("renders error cells and dates", () => {
    expect(cellDisplay({ error: "#DIV/0!" })).toBe("#DIV/0!");
    expect(cellDisplay(new Date("2026-03-01T00:00:00.000Z"))).toBe("2026-03-01");
    expect(cellDisplay(new Date("2026-03-01T14:30:00.000Z"))).toBe(
      "2026-03-01 14:30"
    );
  });
});

describe("describeFileType", () => {
  it("speaks human, naming the app that opens the file", () => {
    expect(describeFileType("pptx")).toEqual({
      label: "PowerPoint presentation",
      hint: "Download to open in PowerPoint or Keynote.",
    });
    expect(describeFileType("doc").label).toBe("Word document (older .doc format)");
    expect(describeFileType("zip")).toEqual({
      label: "Zip archive",
      hint: "Download to unpack.",
    });
    expect(describeFileType("pages").label).toBe("Apple Pages document");
    expect(describeFileType("heic").label).toBe("iPhone photo (HEIC)");
  });

  it("never says binary/unsupported, even for unknown types", () => {
    const t = describeFileType("blorb");
    expect(`${t.label} ${t.hint}`.toLowerCase()).not.toMatch(
      /binary|unsupported/
    );
    expect(t.label).toBe("File");
  });

  it("keeps the failure line calm and code-free", () => {
    expect(PREVIEW_FAILED_HINT).toBe(
      "We couldn't preview this file — download it to open it on your device."
    );
  });
});
