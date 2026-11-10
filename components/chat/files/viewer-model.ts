// Pure classification + display model for the file VIEWER. No React, no DOM —
// everything here is unit-testable in node. file-viewer.tsx owns rendering;
// this module owns "what is this file and how should it be treated".

import { bundledLanguages, type BundledLanguage } from "shiki";

import { getExtension } from "./model";

export type RenderKind =
  | "markdown"
  | "code"
  | "json"
  | "csv"
  | "html"
  | "image"
  | "pdf"
  | "video"
  | "audio"
  | "docx"
  | "sheet"
  | "binary"
  | "note"
  | "text";

// Extension → Shiki language id, for extensions whose id differs from the
// extension itself. Anything NOT listed still resolves when the extension IS
// a bundled id (go, php, html, xml, vue, svelte, lua, dart, zig, sql, java,
// swift, toml, json, …) — resolveLang checks the full ~220-grammar bundle,
// so the long tail renders highlighted instead of falling into a plain pre.
const EXT_ALIASES: Record<string, string> = {
  ts: "typescript",
  mts: "typescript",
  cts: "typescript",
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  py: "python",
  rs: "rust",
  rb: "ruby",
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  yml: "yaml",
  kt: "kotlin",
  kts: "kotlin",
  h: "c",
  hpp: "cpp",
  cc: "cpp",
  cxx: "cpp",
  cs: "csharp",
  fs: "fsharp",
  ex: "elixir",
  exs: "elixir",
  erl: "erlang",
  hs: "haskell",
  pl: "perl",
  ps1: "powershell",
  tf: "terraform",
  dockerfile: "docker",
  gql: "graphql",
  tex: "latex",
  m: "objective-c",
  sol: "solidity",
  proto: "proto",
  svg: "xml",
  plist: "xml",
  conf: "ini",
  env: "dotenv",
};

/** Resolve a file extension to a Shiki language id, or null if even the full
 *  ~220-grammar bundle doesn't know it. Lookup is free — grammars are lazy
 *  imports that only load when a file of that type is actually opened. */
export function resolveLang(ext: string): BundledLanguage | null {
  const id = EXT_ALIASES[ext] ?? ext;
  return id in bundledLanguages ? (id as BundledLanguage) : null;
}

const VIDEO_EXTS = new Set(["mp4", "webm", "mov", "m4v"]);
const AUDIO_EXTS = new Set(["mp3", "wav", "m4a", "ogg", "flac"]);
const HEIC_EXTS = new Set(["heic", "heif"]);

// Formats we can't render inline — offer an honest download card instead of a
// broken preview. docx/xlsx are NOT here: they render client-side (mammoth /
// exceljs). heic/heif look like images but no browser can decode them.
const BINARY_DOC_EXTS = new Set([
  "doc", "pptx", "ppt", "xls", "odt", "ods", "odp", "rtf", "zip",
  "pages", "numbers", "key", "heic", "heif",
]);

// Subset the server-side docpreview converter accepts (mirrors ALLOWED in
// apps/web/app/api/preview/route.ts, minus docx/xlsx which now render
// client-side). Anything else skips the fetch and goes straight to the card.
export const CONVERTIBLE_EXTS = new Set([
  "doc", "pptx", "ppt", "xls", "odt", "ods", "odp", "rtf",
]);

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export function classifyFile(name: string, mime: string): RenderKind {
  const ext = getExtension(name);
  // ".key" is ambiguous: Keynote deck vs. PEM/ssh key. A text mime means it's
  // an actual key file — show its contents, not a Keynote download card.
  if (ext === "key" && mime.startsWith("text/")) return "text";
  // iPhone photos: no browser can decode HEIC/HEIF — the image path would show
  // a broken image, so they get the download card. Must precede image/*.
  if (HEIC_EXTS.has(ext) || mime === "image/heic" || mime === "image/heif")
    return "binary";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (VIDEO_EXTS.has(ext)) return "video";
  if (AUDIO_EXTS.has(ext)) return "audio";
  if (mime === "application/pdf" || ext === "pdf") return "pdf";
  if (ext === "md" || ext === "markdown") return "markdown";
  if (ext === "html" || ext === "htm") return "html";
  if (ext === "json" || ext === "jsonl") return "json";
  if (ext === "csv" || ext === "tsv") return "csv";
  if (ext === "docx" || mime === DOCX_MIME) return "docx";
  if (ext === "xlsx" || mime === XLSX_MIME) return "sheet";
  // .txt reads like a note, not a terminal. (.log stays mono via the shiki
  // "log" grammar → "code" below — alignment matters there.)
  if (ext === "txt" || ext === "text") return "note";
  if (resolveLang(ext)) return "code";
  if (
    BINARY_DOC_EXTS.has(ext) ||
    mime.includes("officedocument") ||
    mime.includes("opendocument") ||
    mime === "application/msword" ||
    mime === "application/vnd.ms-powerpoint" ||
    mime === "application/vnd.ms-excel" ||
    mime === "application/zip"
  )
    return "binary";
  return "note";
}

// ─── Spreadsheet display ────────────────────────────────────────────────────

export const SHEET_ROW_CAP = 1000;

/** How many data rows of a sheet to render, and whether we're truncating. */
export function capSheetRows(
  totalDataRows: number,
  cap = SHEET_ROW_CAP
): { shown: number; truncated: boolean } {
  const total = Math.max(totalDataRows, 0);
  return { shown: Math.min(total, cap), truncated: total > cap };
}

/**
 * Display string for an exceljs cell VALUE. Values only — a formula cell shows
 * its computed result, never the formula. Structural (duck-typed) so it stays
 * pure and testable without importing exceljs.
 */
export function cellDisplay(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) {
    const iso = v.toISOString();
    return iso.endsWith("T00:00:00.000Z") ? iso.slice(0, 10) : iso.slice(0, 16).replace("T", " ");
  }
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if ("result" in o) return cellDisplay(o.result); // formula/sharedFormula
    if ("richText" in o && Array.isArray(o.richText))
      return (o.richText as { text?: string }[]).map((r) => r.text ?? "").join("");
    if ("text" in o) return cellDisplay(o.text); // hyperlink cell
    if ("error" in o) return String(o.error);
    if ("hyperlink" in o) return String(o.hyperlink);
    return ""; // uncached formula, or a shape we don't know — never render junk
  }
  return String(v);
}

// ─── Download-card copy ─────────────────────────────────────────────────────

/** Calm, code-free line for any renderer failure. */
export const PREVIEW_FAILED_HINT =
  "We couldn't preview this file — download it to open it on your device.";

/** Parse a .json/.jsonl document for the tree renderer. JSONL becomes an
 *  array of its lines' values. `undefined` = not parseable (caller falls back
 *  to the code renderer — a real JSON value is never `undefined`). */
export function parseJsonDocument(text: string, name: string): unknown {
  if (getExtension(name) === "jsonl") {
    const lines = text.split("\n").filter((l) => l.trim() !== "");
    if (lines.length === 0) return undefined;
    try {
      return lines.map((l) => JSON.parse(l) as unknown);
    } catch {
      return undefined;
    }
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

/** One-line summary for a collapsed object/array node: what's inside without
 *  opening it. Plain language — non-technical readers see "12 items". */
export function jsonNodeSummary(v: unknown): string {
  if (Array.isArray(v)) {
    return v.length === 1 ? "1 item" : `${v.length} items`;
  }
  const n = Object.keys(v as object).length;
  return n === 1 ? "1 field" : `${n} fields`;
}

export type FileTypeCard = { label: string; hint: string };

const TYPE_CARDS: Record<string, FileTypeCard> = {
  docx: { label: "Word document", hint: "Download to open in Word." },
  doc: { label: "Word document (older .doc format)", hint: "Download to open in Word." },
  pptx: { label: "PowerPoint presentation", hint: "Download to open in PowerPoint or Keynote." },
  ppt: { label: "PowerPoint presentation (older .ppt format)", hint: "Download to open in PowerPoint." },
  xlsx: { label: "Excel spreadsheet", hint: "Download to open in Excel or Numbers." },
  xls: { label: "Excel spreadsheet (older .xls format)", hint: "Download to open in Excel." },
  odt: { label: "OpenDocument text", hint: "Download to open in LibreOffice or Word." },
  ods: { label: "OpenDocument spreadsheet", hint: "Download to open in LibreOffice or Excel." },
  odp: { label: "OpenDocument presentation", hint: "Download to open in LibreOffice or PowerPoint." },
  rtf: { label: "Rich text document", hint: "Download to open in Word or TextEdit." },
  zip: { label: "Zip archive", hint: "Download to unpack." },
  pages: { label: "Apple Pages document", hint: "Download to open in Pages." },
  numbers: { label: "Apple Numbers spreadsheet", hint: "Download to open in Numbers." },
  key: { label: "Apple Keynote presentation", hint: "Download to open in Keynote." },
  heic: { label: "iPhone photo (HEIC)", hint: "Download to view." },
  heif: { label: "iPhone photo (HEIF)", hint: "Download to view." },
  mp4: { label: "Video", hint: "Download to play on your device." },
  webm: { label: "Video", hint: "Download to play on your device." },
  mov: { label: "Video", hint: "Download to play on your device." },
  m4v: { label: "Video", hint: "Download to play on your device." },
  mp3: { label: "Audio", hint: "Download to play on your device." },
  wav: { label: "Audio", hint: "Download to play on your device." },
  m4a: { label: "Audio", hint: "Download to play on your device." },
  ogg: { label: "Audio", hint: "Download to play on your device." },
  flac: { label: "Audio", hint: "Download to play on your device." },
};

/** Plain-language card copy per type. Never "binary" / "unsupported". */
export function describeFileType(ext: string): FileTypeCard {
  return (
    TYPE_CARDS[ext] ?? { label: "File", hint: "Download to open it on your device." }
  );
}
