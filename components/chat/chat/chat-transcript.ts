import type { ToolTables } from "@/components/chat/core/group-tool-runs";
import type { OrbState } from "../lib/orb-state";
import type { Renderers, AnyRow } from "./renderers";
import type { ChatRoomConfig, MessageAction } from "./room-config";

/** The props of <TranscriptRows>: every one must stay referentially stable across keystrokes. */
export type RowsProps<M extends AnyRow = AnyRow, X extends object = object> = {
  messages: M[];
  renderers: Renderers<M, X>;
  /** renderContext(room), shallow-stabilized by the caller. */
  context: X;
  agentUrl: string;
  token: string;
  containerWidth: number | null;
  onRewind: (msgId: string) => void;
  onOpenFile?: (path: string) => void;
  orbFor?: (toolName: string | undefined) => OrbState;
  glyphs?: NonNullable<ChatRoomConfig["tool"]>["glyphs"];
  tables?: ToolTables;
  actionsFor?: (msg: M) => MessageAction<string>[];
};
