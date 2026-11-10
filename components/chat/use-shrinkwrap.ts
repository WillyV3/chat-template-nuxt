import { computed, shallowRef, watch, toValue, type MaybeRefOrGetter, type Ref } from "vue";
import { prepareWithSegments, layoutWithLines } from "@chenglou/pretext";

/**
 * Shrinkwrap a text block to its natural longest-line width using pretext.
 *
 * Measures the text at the given maximum width, finds the longest line's
 * actual pixel width, and returns that. Result is the minimum container
 * width that fits the text without changing how it wraps.
 *
 * The font is read from a live DOM element (via ref) after mount, so the
 * canvas measurements match the browser's DOM layout exactly, including
 * whatever font-family the cascade resolves to.
 *
 * @param text          The text to measure (plain, no markdown)
 * @param maxWidth      The maximum width the text could occupy
 * @param lineHeightPx  Line height in pixels (must match CSS)
 *
 * @returns `{ ref, width }` where `ref` must be attached to an element that
 * has the same typography as the target, and `width` is the shrinkwrapped
 * pixel width (or `null` until measured / on failure).
 */
export function useShrinkwrap(
  text: MaybeRefOrGetter<string>,
  maxWidth: MaybeRefOrGetter<number | null>,
  lineHeightPx: MaybeRefOrGetter<number> = 22,
): { ref: Ref<HTMLElement | null>; width: Readonly<Ref<number | null>> } {
  const ref = shallowRef<HTMLElement | null>(null);
  const font = shallowRef<string | null>(null);

  // Read computed font after mount so we match the DOM's resolved font family
  watch(
    ref,
    (el) => {
      if (!el) return;
      // The `font` shorthand bundles style, variant, weight, size, line-height, family
      // into a single string that canvas measureText accepts.
      const shorthand = getComputedStyle(el).font;
      if (shorthand && shorthand !== font.value) font.value = shorthand;
    },
    { flush: "post" },
  );

  const width = computed<number | null>(() => {
    const t = toValue(text);
    const max = toValue(maxWidth);
    if (!t || !font.value || !max || max <= 0) return null;
    try {
      const prepared = prepareWithSegments(t, font.value);
      const { lines } = layoutWithLines(prepared, max, toValue(lineHeightPx));
      if (lines.length === 0) return null;
      // Longest line determines the natural container width
      let longest = 0;
      for (const line of lines) {
        if (line.width > longest) longest = line.width;
      }
      // Round up to avoid sub-pixel wrapping edge cases
      return Math.ceil(longest);
    } catch {
      return null;
    }
  });

  return { ref, width };
}
