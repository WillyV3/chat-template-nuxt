// ONE shared 30s clock for relative timestamps (audit #6). Every message row
// used to run its own setInterval: a 100-message thread meant 100 timers. All
// rows now subscribe to this single ticker; the interval only exists while
// someone is listening.

import { onScopeDispose, ref, type Ref } from "vue";

const now = ref(Date.now());
let subscribers = 0;
let timer: ReturnType<typeof setInterval> | null = null;

export function useNow30s(): Readonly<Ref<number>> {
  if (typeof window === "undefined") return now;
  subscribers++;
  if (!timer) {
    timer = setInterval(() => {
      now.value = Date.now();
    }, 30_000);
  }
  onScopeDispose(() => {
    subscribers--;
    if (subscribers === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  });
  return now;
}
