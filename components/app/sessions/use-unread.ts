// Per-browser read state for the conversation list. Two memories, both
// localStorage-backed so a New Chat remount can't re-fire the badge:
//   seenReplies: conversations you opened (row dot / bold name)
//   panelSeenAt: when you last opened the panel (the badge cut-off)
// They were the same thing once, and that made the badge lie: seenReplies
// only moves when you click a row, so a reply you read elsewhere lit the
// button forever (Willy 2026-07-27). Opening the panel is the honest "you
// have looked" signal. Derivations (isUnread/freshCount) live in logic.ts.

import { onMounted, ref, toValue, watch } from "vue";
import type { MaybeRefOrGetter } from "vue";

const SEEN_REPLIES_KEY = "chat.sessions.seen-replies";
const PANEL_SEEN_AT_KEY = "chat.sessions.panel-seen-at";

function loadPanelSeenAt(): number {
  const n = Number(window.localStorage.getItem(PANEL_SEEN_AT_KEY) ?? 0);
  return Number.isFinite(n) ? n : 0;
}
function savePanelSeenAt(ms: number) {
  try {
    window.localStorage.setItem(PANEL_SEEN_AT_KEY, String(ms));
  } catch {
    /* private mode */
  }
}
function loadSeenReplies(): Set<string> {
  try {
    const raw = JSON.parse(window.localStorage.getItem(SEEN_REPLIES_KEY) ?? "[]") as unknown;
    return new Set(Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}
function saveSeenReplies(ids: Set<string>) {
  try {
    window.localStorage.setItem(SEEN_REPLIES_KEY, JSON.stringify([...ids].slice(-200)));
  } catch {
    /* private mode */
  }
}

/** `panelOpen` stamps "you have looked" on every open, in a watcher, not
 *  onOpenChange, because the inbox button sets open state directly and the
 *  Sheet only fires update:open for its own triggers. */
export function useUnread(panelOpen: MaybeRefOrGetter<boolean>) {
  const seenReplies = ref<ReadonlySet<string>>(new Set());
  const panelSeenAt = ref(0);
  // Deliberate mount-load, not a lazy initializer: SSR renders empty, so
  // reading localStorage during setup would mismatch on hydration.
  onMounted(() => {
    seenReplies.value = loadSeenReplies();
    panelSeenAt.value = loadPanelSeenAt();
  });
  watch(
    () => toValue(panelOpen),
    (open) => {
      if (!open) return;
      const now = Date.now();
      panelSeenAt.value = now;
      savePanelSeenAt(now);
    },
    { immediate: true },
  );

  function markSeen(lastId: string) {
    if (seenReplies.value.has(lastId)) return;
    const next = new Set(seenReplies.value).add(lastId);
    seenReplies.value = next;
    saveSeenReplies(next);
  }
  // Mark as unread = forget you opened it: the row dot comes back and the
  // name bolds again. (The badge doesn't re-ring: you're looking at it.)
  function markUnread(lastId: string) {
    if (!seenReplies.value.has(lastId)) return;
    const next = new Set(seenReplies.value);
    next.delete(lastId);
    seenReplies.value = next;
    saveSeenReplies(next);
  }

  return { seenReplies, panelSeenAt, markSeen, markUnread };
}
