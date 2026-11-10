// Session management (mute + archive), from Sontara's circle/use-circle-prefs.
// Sontara syncs these sets to user_preferences with a whole-list PUT and
// optimistic toggles; here they live in memory. To persist them, put the PUT
// back in `toggle` (set optimistically, revert on refusal).

import { ref } from "vue";
import type { MaybeRefOrGetter } from "vue";

/** `_active` is kept for Sontara's signature (it gated the first fetch). */
export function useCirclePrefs(_active?: MaybeRefOrGetter<boolean>) {
  const muted = ref<ReadonlySet<string>>(new Set());
  const archived = ref<ReadonlySet<string>>(new Set());
  function toggle(kind: "muted" | "archived", id: string) {
    const target = kind === "muted" ? muted : archived;
    const next = new Set(target.value);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    target.value = next;
  }
  return {
    muted,
    archived,
    toggleMuted: (id: string) => toggle("muted", id),
    toggleArchived: (id: string) => toggle("archived", id),
  };
}
