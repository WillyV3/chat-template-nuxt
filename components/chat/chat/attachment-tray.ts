import { formatSize } from "../files/model";
import type { RoomPill } from "./room-io";

/** What a pill's second line says: where it lives, and how big. */
export function pillCaption(pill: Pick<RoomPill, "uploading" | "size" | "path">): string {
  if (pill.uploading) return "Uploading…";
  return [pill.size !== undefined ? formatSize(pill.size) : null, pill.path]
    .filter((part): part is string => !!part)
    .join(" · ");
}
