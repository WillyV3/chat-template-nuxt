<script setup lang="ts">
// One line standing in for a run of tool calls.
//
// A customer asked one question and got 56 tool rows before the answer
// (report 909f821e, 2026-10-01): rendered individually they bury whatever
// the user actually needs to see. This collapses the run into one line and
// keeps every real row one click away: the calls still matter when
// something breaks, so they're hidden, never dropped. While the run is still
// going the line stays live (ticking step count, current tool's family):
// folding must never read as a frozen, dead row.
import { computed, ref } from "vue";
import { ChevronRight, Wrench } from "@lucide/vue";

import AgentOrb from "@/components/chat/agent-orb.vue";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  currentlyRunning,
  summarizeToolRun,
  type GroupableRow,
  type ToolTables,
} from "@/components/chat/core/group-tool-runs";
import { orbForTool } from "@/components/chat/lib/orb-state";
import type { OrbState } from "@/components/chat/orb/modes";
import { cn } from "@/lib/utils";

const props = withDefaults(
  defineProps<{
    /** The folded rows: read for the live label (count, families, running
     *  tool), never rendered here directly. The default slot carries the real
     *  rows, shown only once opened. */
    messages: GroupableRow[];
    /** A host's own tool families for the label. Absent = Sontara's. */
    tables?: ToolTables;
    /** A host's own tool -> orb mapping. Absent = Sontara's. */
    orbFor?: (toolName: string | undefined) => OrbState;
  }>(),
  { orbFor: orbForTool },
);

const open = ref(false);
const failed = computed(() => props.messages.filter((m) => m.toolStatus === "error").length);
const running = computed(() => currentlyRunning(props.messages));
const label = computed(() => summarizeToolRun(props.messages, props.tables));
</script>

<template>
  <div class="my-1">
    <Collapsible v-model:open="open">
      <CollapsibleTrigger
        :class="
          cn(
            'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs',
            'text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          )
        "
      >
        <ChevronRight
          :class="cn('size-3.5 shrink-0 transition-transform', open && 'rotate-90')"
          aria-hidden="true"
        />
        <AgentOrb v-if="running" :state="orbFor(running.toolName)" :size="20" />
        <Wrench v-else class="size-3.5 shrink-0" aria-hidden="true" />
        <span :class="cn(failed > 0 && 'text-amber-600 dark:text-amber-400')">{{ label }}</span>
      </CollapsibleTrigger>
      <CollapsibleContent
        class="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down"
      >
        <div class="mt-1 space-y-1 border-l border-border/60 pl-3">
          <slot />
        </div>
      </CollapsibleContent>
    </Collapsible>
  </div>
</template>
