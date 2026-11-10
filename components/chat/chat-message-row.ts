// Non-component exports of the transcript-row components (the five components
// that render ONE row each live in their own .vue files beside this one).
//
// Extracted from agent-chat.tsx on 2026-08-07 (step 2 of the split). This was a
// real seam, not a convenient-looking one: every component takes ONLY props and
// closes over none of the container's state, refs or effects, which is exactly
// the property the container's other concerns (the send path, relay, the
// composer) do NOT have.
//
// WHY IT MATTERS BEYOND LINE COUNT: adding componentry to the conversation
// window now means editing a small file whose whole job is drawing a row,
// instead of a 2,300-line file where a mistake can reach the socket. The three
// exported bubbles are the extension points; message-actions, host-actions,
// tool-status-glyph and toolIcon are private to this row family.
import type { Component } from "vue";
import {
  Wrench,
  Terminal,
  FileText,
  FilePenLine,
  FileX,
  Database,
  Search,
  Eraser,
  Shield,
  Globe,
  Plug,
} from "@lucide/vue";

import { toolGlyph, type ToolGlyph } from "@/components/chat/core/group-tool-runs";
import type { ChatRoomConfig } from "@/components/chat/chat/room-config";

/** The host's tool overrides (ChatRoomConfig["tool"]). Absent = Sontara's. */
export type ToolSeams = NonNullable<ChatRoomConfig["tool"]>;

/** Tool name -> icon. The name->glyph table is core's `toolGlyph` (one
 *  table for web AND mobile); this only binds glyphs to this face's icon set. */
export const GLYPH_ICONS: Record<ToolGlyph, Component> = {
  terminal: Terminal,
  "file-read": FileText,
  "file-write": FilePenLine,
  "file-delete": FileX,
  database: Database,
  search: Search,
  eraser: Eraser,
  shield: Shield,
  plug: Plug,
  globe: Globe,
  wrench: Wrench,
};

export function toolIcon(name: string, glyphs?: ToolSeams["glyphs"]): Component {
  const g = toolGlyph(name);
  return (glyphs?.[g] as Component | undefined) ?? GLYPH_ICONS[g];
}
