<script setup lang="ts">
// Status glyph for a tool row.
//
// RUNNING gets the orb for what that tool is actually doing (searching /
// solving / composing / ...), so the transcript and the standalone thinking
// bubble speak the same visual language instead of a generic amber dot that
// meant only "busy". Same mapping, one source: lib/orb-state.ts.
//
// Finished states stay a flat tick / alert on purpose: an orb is motion, and
// motion on a settled row draws the eye to something that already happened.
import { Check, CircleAlert } from "@lucide/vue";

import AgentOrb from "@/components/chat/agent-orb.vue";
import type { OrbState } from "@/components/chat/orb/modes";
import type { ToolStatus } from "@/components/chat/core/chat-model";
import { orbForTool } from "@/components/chat/lib/orb-state";

withDefaults(
  defineProps<{
    status?: ToolStatus;
    toolName?: string;
    orbFor?: (toolName: string | undefined) => OrbState;
  }>(),
  { orbFor: orbForTool },
);
</script>

<template>
  <AgentOrb v-if="status === 'running'" :state="orbFor(toolName)" :size="20" />
  <CircleAlert v-else-if="status === 'error'" class="size-3 shrink-0 text-red-500" />
  <Check v-else class="size-3 shrink-0 text-emerald-500/70" />
</template>
