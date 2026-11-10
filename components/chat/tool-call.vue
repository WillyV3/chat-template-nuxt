<script setup lang="ts">
// A minimal "thinking trace" row: dashed left-rail, per-tool icon,
// monospace name, status, duration. Click to expand args + output.
// Consecutive tool rows visually chain via their shared border-l.
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { ChevronDown } from "@lucide/vue";
import { motion } from "motion-v";

import { toolIcon, type ToolSeams } from "@/components/chat/chat-message-row";
import ToolStatusGlyph from "@/components/chat/tool-status-glyph.vue";
import type { ToolStatus } from "@/components/chat/core/chat-model";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

const props = defineProps<{
  /** A host's tool -> orb mapping. Absent = Sontara's. */
  orbFor?: ToolSeams["orbFor"];
  /** A host's glyph -> icon overrides, merged over the defaults. */
  glyphs?: ToolSeams["glyphs"];
  toolName: string;
  status?: ToolStatus;
  args?: Record<string, unknown>;
  output: string;
  createdAtMs?: number;
  /** Measured when the result arrived. Absent on rows rebuilt from history. */
  durationMs?: number;
}>();

const open = ref(false);
// Holds the CLOCK, not a tick counter: the duration is derived from it, so a
// finished tool's duration freezes at completion instead of growing whenever
// something unrelated re-renders the transcript.
const nowMs = ref(Date.now());

let interval: ReturnType<typeof setInterval> | undefined;
watch(
  () => props.status,
  (status) => {
    clearInterval(interval);
    interval = undefined;
    // Running tool -> re-read the clock every 200ms so the duration ticks.
    if (status === "running") interval = setInterval(() => (nowMs.value = Date.now()), 200);
  },
  { immediate: true },
);
onBeforeUnmount(() => clearInterval(interval));

// A MEASURED duration once the result lands; a live tick while it runs.
// A row rebuilt from history has neither: it only knows WHEN the message
// was, not how long the tool took. The old `now - createdAtMs` published
// that gap as a duration, so after a reload every historical tool call
// showed a number that grew the longer the page stayed open ("1m", "48.3s"
// for calls that took milliseconds).
const durationLabel = computed(() => {
  const elapsedMs =
    props.durationMs ??
    (props.status === "running" && props.createdAtMs ? nowMs.value - props.createdAtMs : undefined);
  if (elapsedMs === undefined) return null;
  if (elapsedMs < 1000) return `${elapsedMs}ms`;
  if (elapsedMs < 60_000) return `${(elapsedMs / 1000).toFixed(1)}s`;
  return `${Math.floor(elapsedMs / 60_000)}m`;
});

const hasArgs = computed(() => Boolean(props.args && Object.keys(props.args).length > 0));
const hasBody = computed(() => hasArgs.value || Boolean(props.output && props.output.length > 0));
const icon = computed(() => toolIcon(props.toolName, props.glyphs));
</script>

<template>
  <motion.div
    :initial="{ opacity: 0, y: -4 }"
    :animate="{ opacity: 1, y: 0 }"
    :transition="{ duration: 0.15, ease: 'easeOut' }"
    class="group/tool relative max-w-[90%] pl-1"
  >
    <Collapsible v-model:open="open" :disabled="!hasBody">
      <CollapsibleTrigger
        as-child
        :class="
          cn(
            'flex w-full items-center gap-2 py-0.5 transition-colors',
            hasBody && 'cursor-pointer hover:text-foreground',
            !hasBody && 'cursor-default',
          )
        "
      >
        <div>
          <!-- a11y: raised opacity floors so dark-mode contrast clears
               WCAG AA (4.5:1). Pre-launch audit (2026-05-15) measured the
               previous /60, /45, /30 classes at 2.61:1 / 1.97:1 / 1.51:1
               in dark mode, well below the floor. -->
          <component
            :is="icon"
            :class="
              cn(
                'size-3 shrink-0 text-muted-foreground',
                status === 'running' && 'animate-pulse',
                status === 'error' && 'text-red-500',
              )
            "
            aria-hidden="true"
          />
          <span
            :class="
              cn(
                'truncate font-sans text-[10px] font-light tracking-wide text-muted-foreground',
                status === 'error' && 'text-red-500',
              )
            "
          >
            {{ toolName }}
          </span>
          <ToolStatusGlyph :status="status" :tool-name="toolName" :orb-for="orbFor" />
          <span
            v-if="durationLabel"
            class="font-mono text-[9px] font-light tabular-nums text-muted-foreground/70"
          >
            {{ durationLabel }}
          </span>
          <ChevronDown
            v-if="hasBody"
            :class="
              cn(
                'ml-auto size-2.5 shrink-0 text-muted-foreground/70 transition-transform',
                open && 'rotate-180',
              )
            "
            aria-hidden="true"
          />
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent
        class="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down"
      >
        <div class="mb-1 mt-0.5 space-y-1.5 pl-5 pr-2">
          <div v-if="hasArgs">
            <div
              class="mb-0.5 font-sans text-[8.5px] font-medium uppercase tracking-[0.14em] text-muted-foreground/80"
            >
              Input
            </div>
            <!-- whitespace-pre-wrap + break-all to match the Output block
                 below. Without them a long argument value ran off the right
                 edge and was clipped MID-WORD: on a phone you could see
                 `"content": "Hey willyv4! Picking up on the flee` and no way
                 to read the rest, because a horizontal scrollbar inside a
                 140px-tall box is not reachable on touch. -->
            <pre
              class="max-h-24 overflow-auto whitespace-pre-wrap break-all rounded-sm bg-muted/20 px-2 py-1 font-mono text-[10px] leading-snug text-muted-foreground/80"
            >{{ JSON.stringify(args, null, 2) }}</pre>
          </div>
          <div v-if="output">
            <div
              :class="
                cn(
                  'mb-0.5 font-sans text-[8.5px] font-medium uppercase tracking-[0.14em]',
                  status === 'error' ? 'text-red-500' : 'text-muted-foreground/80',
                )
              "
            >
              {{ status === "error" ? "Error" : "Output" }}
            </div>
            <pre
              :class="
                cn(
                  'max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-sm px-2 py-1 font-mono text-[10px] leading-snug',
                  status === 'error'
                    ? 'bg-red-500/5 text-red-600/80 dark:text-red-400/80'
                    : 'bg-muted/20 text-muted-foreground/80',
                )
              "
            >{{ output }}</pre>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  </motion.div>
</template>
