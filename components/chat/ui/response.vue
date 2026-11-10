<script setup lang="ts">
// Streaming markdown for assistant text. Vue replacement for `streamdown`:
// vue-stream-markdown (incomplete-markdown completion while streaming,
// hardened links/images, shiki code blocks via @stream-markdown/code, tables).
import { code } from "@stream-markdown/code";
import { computed, onMounted, onBeforeUnmount, ref, useSlots, type HTMLAttributes } from "vue";
import { Markdown } from "vue-stream-markdown";
import "vue-stream-markdown/index.css";

import { cn } from "@/lib/utils";
import { openFileLink, resolveFileHref, type FileDownloadContext } from "./response";

defineOptions({ inheritAttrs: false });

const props = defineProps<{
  /** The markdown. Pass as `content`, or as the default slot's text. */
  content?: string;
  /**
   * When set, markdown links the agent writes to files it created in `shared/`
   * (e.g. `[report](shared/report.pdf)`) render as one-click AUTHENTICATED
   * downloads instead of a blocked span, or, when `onOpen` is given, as a
   * preview open instead of a download (see `FileDownloadContext`).
   * See ./response.ts for the mechanics.
   */
  fileDownload?: FileDownloadContext;
  class?: HTMLAttributes["class"];
}>();

const slots = useSlots();
const source = computed(() => {
  if (props.content !== undefined) return props.content;
  return (slots.default?.() ?? []).map((v) => (typeof v.children === "string" ? v.children : "")).join("");
});

// Shiki theme follows the `.dark` class on <html> (owned by the theme layer).
const isDark = ref(false);
let mo: MutationObserver | null = null;
onMounted(() => {
  const root = document.documentElement;
  const sync = () => (isDark.value = root.classList.contains("dark"));
  sync();
  mo = new MutationObserver(sync);
  mo.observe(root, { attributes: true, attributeFilter: ["class"] });
});
onBeforeUnmount(() => mo?.disconnect());

const extensions = { code: code() };

// Relative `shared/x` hrefs resolve against the agent instead of being blocked.
const hardenOptions = computed(() =>
  props.fileDownload ? { defaultOrigin: props.fileDownload.agentUrl } : undefined,
);
// Safety interstitial off: file clicks never reach the library's own handler,
// and external links open directly, as with Streamdown's `linkSafety: off`.
const linkOptions = { safetyCheck: false };

function onClick(e: MouseEvent) {
  const fd = props.fileDownload;
  if (!fd) return;
  const a = (e.target as Element | null)?.closest?.("a[href]");
  if (!a) return;
  const href = resolveFileHref(a.getAttribute("href") ?? "", fd.agentUrl);
  if (!href) return;
  e.preventDefault();
  e.stopPropagation();
  openFileLink(href, fd.token, fd.onOpen);
}
</script>

<template>
  <div
    :class="
      cn(
        'size-full min-w-0 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
        // Wide content scrolls INSIDE ITS OWN BOX; the conversation never
        // scrolls sideways. Markdown produces three things that are wider
        // than a phone and have no opinion about it:
        //   break-words  - an unbroken URL or token, which otherwise sets the
        //                  container's min-content width all by itself
        //   pre          - a long code line
        //   table        - needs `block` to be scrollable at all; a table box
        //                  ignores overflow-x and sizes to its columns
        'break-words',
        '[&_pre]:max-w-full [&_pre]:overflow-x-auto',
        '[&_table]:block [&_table]:max-w-full [&_table]:overflow-x-auto',
        props.class,
      )
    "
    @click.capture="onClick"
  >
    <Markdown
      v-bind="$attrs"
      :content="source"
      :is-dark="isDark"
      :extensions="extensions"
      :harden-options="hardenOptions"
      :link-options="linkOptions"
    />
  </div>
</template>
