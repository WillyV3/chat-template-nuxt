// THE media-query composable (audit #4): reactive to OS/theme changes, no
// first-paint flash. Server render uses `serverDefault`; onMounted syncs the
// real value in the same tick as mount (before the browser paints), the Vue
// analogue of useSyncExternalStore's server snapshot.

import { onBeforeUnmount, onMounted, ref, toValue, watch, type MaybeRefOrGetter, type Ref } from "vue";

export function useMediaQuery(query: MaybeRefOrGetter<string>, serverDefault = false): Ref<boolean> {
  const matches = ref(serverDefault);
  let mql: MediaQueryList | null = null;
  const sync = () => {
    if (mql) matches.value = mql.matches;
  };
  const bind = (q: string) => {
    mql?.removeEventListener("change", sync);
    mql = window.matchMedia(q);
    mql.addEventListener("change", sync);
    sync();
  };
  onMounted(() => {
    watch(() => toValue(query), bind, { immediate: true });
  });
  onBeforeUnmount(() => mql?.removeEventListener("change", sync));
  return matches;
}

export function usePrefersReducedMotion(): Ref<boolean> {
  return useMediaQuery("(prefers-reduced-motion: reduce)");
}
