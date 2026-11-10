import { computed, ref, toValue, watch, type MaybeRefOrGetter } from "vue";

/**
 * Paced character reveal for live-streaming text.
 *
 * When `target` grows (e.g. WebSocket delta arrives with 300 new chars), this
 * composable doesn't drop the new content on screen instantly: it walks a cursor
 * forward at `cps` chars/second using a single rAF loop, so the user sees a
 * steady typewriter rhythm instead of a wall-of-text jolt. When `streaming`
 * goes false, it flushes the remainder so the final text is always complete.
 *
 * Use only for the in-flight assistant message. History messages render
 * `target` directly.
 *
 * @param target    The full text so far (grows as deltas arrive).
 * @param streaming Whether the source is still emitting. False = flush now.
 * @param cps       Reveal rate in chars per second (default 80).
 */
export function useSmoothedText(
  target: MaybeRefOrGetter<string>,
  streaming: MaybeRefOrGetter<boolean>,
  cps: MaybeRefOrGetter<number> = 80,
) {
  const displayed = ref("");
  let cursor = 0;
  let lastTick = 0;
  let raf: number | null = null;

  // Keep the cursor honest. Plain writes only: the value it would set is
  // derivable at return, so it is derived there.
  watch(
    [() => toValue(target), () => toValue(streaming)],
    ([t, s]) => {
      if (!s) {
        cursor = t.length;
        return;
      }
      if (t.length < cursor) {
        // Target got shorter than what we already showed (message replaced).
        cursor = t.length;
      }
    },
    { immediate: true },
  );

  // Animation loop: advance cursor at `cps` until it catches the target.
  watch(
    [() => toValue(target), () => toValue(streaming), () => toValue(cps)],
    ([t, s, rate], _old, onCleanup) => {
      if (!s || typeof requestAnimationFrame === "undefined") return;

      function tick(ts: number) {
        if (lastTick === 0) {
          lastTick = ts;
          raf = requestAnimationFrame(tick);
          return;
        }
        const elapsedMs = ts - lastTick;
        lastTick = ts;

        const remaining = t.length - cursor;
        if (remaining <= 0) {
          raf = requestAnimationFrame(tick);
          return;
        }

        // Chars to reveal this frame, with a floor of 1 once the timer budget
        // passes threshold. Keeps the reveal snappy on short deltas and steady
        // on long ones. If we ever fall more than ~1.5s behind (model dumped a
        // huge chunk at once), fast-forward so the UI never stalls.
        const budget = Math.max(1, Math.floor((elapsedMs * rate) / 1000));
        let step = Math.min(remaining, budget);
        if (remaining > rate * 1.5) {
          // Behind by >1.5s of content -- catch up aggressively
          step = Math.min(remaining, Math.max(step, Math.floor(remaining / 4)));
        }

        cursor += step;
        displayed.value = t.slice(0, cursor);
        raf = requestAnimationFrame(tick);
      }

      raf = requestAnimationFrame(tick);
      onCleanup(() => {
        if (raf !== null) cancelAnimationFrame(raf);
        raf = null;
        lastTick = 0;
      });
    },
    { immediate: true },
  );

  // DERIVED, not stored.
  //
  // Not streaming: the answer IS the target, so the final text is complete on
  // the very first render rather than one commit later.
  //
  // Streaming: the paced reveal, clamped so a target that SHRANK (message
  // replaced, history loaded) can never show stale characters past its end.
  return computed(() => {
    const t = toValue(target);
    if (!toValue(streaming)) return t;
    return displayed.value.length > t.length ? t : displayed.value;
  });
}
