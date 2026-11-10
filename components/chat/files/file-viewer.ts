import type { Worksheet } from "exceljs";
import { createHighlighter, type Highlighter } from "shiki";

import { formatSize, getExtension, type FileEntry } from "./model";
import { capSheetRows, cellDisplay } from "./viewer-model";

// Re-exported so viewer consumers keep one import site for file metadata.
export { formatSize, getExtension, type FileEntry };

/** CJS/ESM interop for the dynamically imported parser libs: node and each
 *  bundler disagree on whether module.exports lands on the namespace or under
 *  `.default` (exceljs ships only `.default` under node ESM) — take whichever
 *  is populated. */
export function interopDefault<T>(mod: T): T {
  const m = mod as T & { default?: T };
  return m.default ?? mod;
}

/** Authed download URL for a file — same endpoint the browser toolbar uses. */
export function fileDownloadUrl(agentUrl: string, file: FileEntry): string {
  const qs = file.path ? `?path=${encodeURIComponent(file.path)}` : "";
  return `${agentUrl}/api/files/${encodeURIComponent(file.name)}/download${qs}`;
}

// ─── Shiki singleton ────────────────────────────────────────────────────────

let highlighterPromise: Promise<Highlighter> | null = null;

export function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ["github-light-default", "github-dark-default"],
      // Start with ZERO grammars: CodeRenderer lazy-loads exactly what each
      // opened file needs, so one .py costs one grammar and the other ~219
      // stay reachable without bundle weight.
      langs: [],
    });
  }
  return highlighterPromise;
}

// ─── Shared prose classes ───────────────────────────────────────────────────

export const MARKDOWN_PROSE_CLASSES = [
  // Tight typographic mirror of @tailwindcss/typography "prose" output —
  // we don't have the plugin installed (matches /privacy + /terms approach).
  "[&_h1]:font-display [&_h1]:text-3xl [&_h1]:font-medium [&_h1]:tracking-tight [&_h1]:mt-0 [&_h1]:mb-6",
  "[&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-medium [&_h2]:tracking-tight [&_h2]:mt-10 [&_h2]:mb-4",
  "[&_h3]:font-display [&_h3]:text-lg [&_h3]:font-medium [&_h3]:tracking-tight [&_h3]:mt-8 [&_h3]:mb-3",
  "[&_h4]:font-medium [&_h4]:text-base [&_h4]:mt-6 [&_h4]:mb-2",
  "[&_p]:leading-relaxed [&_p]:mb-4 [&_p]:text-foreground/90",
  "[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4 [&_a]:decoration-primary/40 hover:[&_a]:decoration-primary",
  "[&_ul]:my-4 [&_ul]:pl-6 [&_ul]:list-disc [&_ul]:space-y-1",
  "[&_ol]:my-4 [&_ol]:pl-6 [&_ol]:list-decimal [&_ol]:space-y-1",
  "[&_li]:leading-relaxed [&_li]:text-foreground/90",
  "[&_blockquote]:border-l-2 [&_blockquote]:border-primary/60 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:font-serif [&_blockquote]:text-foreground/80 [&_blockquote]:my-6",
  "[&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:font-mono [&_code]:text-[0.875em]",
  "[&_pre]:bg-muted [&_pre]:rounded-lg [&_pre]:p-4 [&_pre]:overflow-x-auto [&_pre]:my-5 [&_pre]:text-sm [&_pre]:leading-relaxed",
  "[&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-[0.875em]",
  "[&_hr]:my-8 [&_hr]:border-border",
  "[&_table]:my-5 [&_table]:w-full [&_table]:border-collapse [&_table]:text-sm",
  "[&_th]:border-b [&_th]:border-border [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold",
  "[&_td]:border-b [&_td]:border-border/50 [&_td]:px-3 [&_td]:py-2",
  "[&_img]:rounded-lg [&_img]:my-4 [&_img]:max-w-full",
].join(" ");

// ─── CSV ───

export function parseCsv(text: string, sep = ","): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuote = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuote) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') {
        inQuote = false;
      } else {
        cell += c;
      }
    } else {
      if (c === '"') inQuote = true;
      else if (c === sep) {
        row.push(cell);
        cell = "";
      } else if (c === "\n") {
        row.push(cell);
        rows.push(row);
        row = [];
        cell = "";
      } else if (c === "\r") {
        // skip
      } else {
        cell += c;
      }
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.length > 1 || (r.length === 1 && r[0].length > 0));
}

export function isNumeric(s: string): boolean {
  if (s == null || s === "") return false;
  return !isNaN(Number(s)) && /^-?\d*\.?\d+(?:[eE][-+]?\d+)?$/.test(s.trim());
}

// ─── XLSX ───

export type ParsedSheet = {
  name: string;
  header: string[];
  rows: string[][];
  totalDataRows: number;
  truncated: boolean;
};

/** First row = header (mirrors the CSV treatment). Rows are capped up front so
 *  a 100k-row workbook never reaches the UI. */
export function worksheetToSheet(ws: Worksheet): ParsedSheet {
  const totalDataRows = Math.max(ws.rowCount - 1, 0);
  const { shown, truncated } = capSheetRows(totalDataRows);
  const cols = ws.columnCount;
  const grid: string[][] = [];
  for (let r = 1; r <= shown + 1 && r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const cells: string[] = [];
    for (let c = 1; c <= cols; c++) cells.push(cellDisplay(row.getCell(c).value));
    grid.push(cells);
  }
  return {
    name: ws.name,
    header: grid[0] ?? [],
    rows: grid.slice(1),
    totalDataRows,
    truncated,
  };
}
