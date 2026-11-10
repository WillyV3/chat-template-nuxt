// Where a paperclip upload can be told to land. The upload endpoint
// (services/sontara/src/gateway/mod.rs handle_upload) already accepts
// `?path=<subdir under shared/>` and validates it server-side (rejects `..`,
// `.`, backslashes) — this is the picker's fixed menu of that param.
//
// ponytail: a fixed list, not the live workspace folder tree. The Files tab
// already fetches real folders via useFiles(gateway)'s `files.list` RPC
// (files/use-files.ts) — wiring that into the composer would mean the
// attach-menu hook subscribing to gateway `files.changed` events just to
// populate a menu that opens rarely. Swap this constant for that live list
// (pass `gateway` into useComposerAttachments, reuse useFiles) if users want
// to save straight into a folder they made themselves.
export const ATTACH_DESTINATIONS = [
  { label: "Uploads", path: "Uploads" },
  { label: "Images", path: "Images" },
  { label: "Documents", path: "Documents" },
] as const;

export type AttachDestinationPath = (typeof ATTACH_DESTINATIONS)[number]["path"];

export const DEFAULT_ATTACH_DESTINATION: AttachDestinationPath = "Uploads";

/**
 * Build the `?path=` query fragment for a chosen destination. Restricted to
 * the fixed menu above — anything else (a stray value, a future bug that
 * threads user input in here) falls back to the default rather than being
 * forwarded verbatim. The real traversal guard is server-side
 * (handle_upload rejects `..`/`.` segments); this is defense in depth so the
 * frontend can never even ATTEMPT to send a path outside the offered set.
 */
export function uploadPathQuery(dest: string): string {
  const known = ATTACH_DESTINATIONS.some((d) => d.path === dest);
  return `?path=${encodeURIComponent(known ? dest : DEFAULT_ATTACH_DESTINATION)}`;
}
