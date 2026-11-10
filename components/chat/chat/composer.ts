import type { VoiceState } from "./room-config";

/** The composer's placeholder: the voice state outranks connectivity. */
export function composerPlaceholder(voice: VoiceState | undefined, connected: boolean): string {
  if (voice === "listening") return "Listening...";
  return connected ? "Message your agent..." : "Connecting...";
}
