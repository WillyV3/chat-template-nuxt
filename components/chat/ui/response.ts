// Pure helpers behind <Response>'s `fileDownload` mode (response.vue).
//
// The React original rewrote `shared/x` link URLs in a remark plugin and
// swapped in a custom `a` renderer. vue-stream-markdown has no remark stage, so
// the same three moves are done differently but with the same effect:
//   1. its harden pass resolves the relative `shared/x` against `agentUrl`
//      (hardenOptions.defaultOrigin) instead of rendering it as blocked;
//   2. a capture-phase click handler on the wrapper recognises that link;
//   3. it calls `onOpen` with the logical `shared/...` path, or fetches the
//      file with the bearer token in the Authorization header (never in the
//      URL) and saves the blob, mirroring the Files tab.
// External links keep the library's own behaviour (new tab, noreferrer);
// `javascript:` / `data:` links stay blocked by its harden pass.

import { downloadAuthed } from "@/components/chat/lib/download";

export type FileDownloadContext = {
  /** Agent base URL, e.g. `https://{subdomain}.sontara.ai`. */
  agentUrl: string;
  /** Gateway bearer token, used for authenticated file downloads. */
  token: string;
  /**
   * When set, a click on a `shared/x` link calls this with the file's
   * logical path (e.g. `"shared/report.pdf"`) INSTEAD OF downloading:
   * the caller opens it in the existing file viewer/sheet. Download stays
   * reachable from there (the viewer's own toolbar). Omitted = unchanged
   * download-on-click behavior.
   */
  onOpen?: (path: string) => void;
};

const SHARED_HREF = /^\/?shared\/(.+)$/i;
const DOWNLOAD_HREF = /\/api\/files\/([^/?]+)\/download(?:\?path=([^&]*))?/;

export function sharedToDownloadUrl(agentUrl: string, rest: string): string {
  const parts = rest.split("/").filter(Boolean);
  const filename = parts.pop() ?? "";
  const dir = parts.join("/");
  const qs = dir ? `?path=${encodeURIComponent(dir)}` : "";
  return `${agentUrl}/api/files/${encodeURIComponent(filename)}/download${qs}`;
}

export function isDownloadHref(href: string): boolean {
  return href.includes("/api/files/") && href.includes("/download");
}

/** Inverse of `sharedToDownloadUrl`: recover the logical `shared/...` path
 *  from a rewritten download href. By click time only the rewritten href
 *  exists, so `onOpen` needs this to hand the caller back the path it
 *  understands. Returns null if `href` isn't a download URL we produced. */
export function downloadHrefToSharedPath(href: string): string | null {
  const m = href.match(DOWNLOAD_HREF);
  if (!m) return null;
  const filename = decodeURIComponent(m[1]);
  const dir = m[2] ? decodeURIComponent(m[2]) : "";
  return `shared/${dir ? `${dir}/` : ""}${filename}`;
}

/** The download URL a rendered `<a href>` stands for, or null when it is an
 *  ordinary link. Handles the three shapes the harden pass can leave behind:
 *  the agent's own `/api/files/.../download` URL, and `shared/x` resolved
 *  against the agent origin (absolute `https://agent/shared/x`, or the
 *  path-only `/shared/x`). */
export function resolveFileHref(href: string, agentUrl: string): string | null {
  if (isDownloadHref(href)) return href;
  let url: URL;
  try {
    url = new URL(href, agentUrl);
  } catch {
    return null;
  }
  if (url.origin !== new URL(agentUrl).origin) return null;
  const m = decodeURIComponent(url.pathname).match(SHARED_HREF);
  return m ? sharedToDownloadUrl(agentUrl, m[1]) : null;
}

function downloadFile(url: string, token: string): Promise<void> {
  const m = url.match(/\/api\/files\/([^/?]+)\/download/);
  return downloadAuthed(url, token, m ? decodeURIComponent(m[1]) : "download");
}

/** What a click on a file link does: open in the viewer when `onOpen` is
 *  given, else the authenticated download. */
export function openFileLink(
  downloadHref: string,
  token: string,
  onOpen?: (path: string) => void,
): void {
  if (onOpen) {
    const path = downloadHrefToSharedPath(downloadHref);
    if (path) {
      onOpen(path);
      return;
    }
  }
  downloadFile(downloadHref, token).catch((err) => console.error("file download failed", err));
}
