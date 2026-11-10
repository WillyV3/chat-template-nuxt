<script setup lang="ts">
import { computed, ref } from "vue"
import { cn } from "@/lib/utils"
import { jsonNodeSummary } from "./viewer-model"

const JSON_CHILD_CAP = 50

const props = defineProps<{
  value: unknown
  label: string | null
  depth: number
}>()

// Top level starts open so the file shows its shape immediately.
const open = ref(props.depth === 0)
const shown = ref(JSON_CHILD_CAP)

const isBranch = computed(() => typeof props.value === "object" && props.value !== null)
const isArray = computed(() => Array.isArray(props.value))
const entries = computed<[string, unknown][]>(() => {
  if (!isBranch.value) return []
  return Array.isArray(props.value)
    ? props.value.map((v, i) => [String(i), v] as [string, unknown])
    : Object.entries(props.value as Record<string, unknown>)
})
</script>

<template>
  <div v-if="!isBranch" class="break-words py-0.5">
    <span v-if="label !== null" class="font-medium text-foreground">{{ label }}: </span>
    <span v-if="typeof value === 'string'" class="break-words text-primary">"{{ value }}"</span>
    <span v-else-if="value === null || typeof value === 'boolean'" class="italic text-muted-foreground">{{ String(value) }}</span>
    <span v-else class="text-foreground/80">{{ String(value) }}</span>
  </div>
  <details
    v-else
    :open="open"
    class="py-0.5"
    @toggle="open = ($event.target as HTMLDetailsElement).open"
  >
    <summary class="cursor-pointer select-none list-none marker:hidden [&::-webkit-details-marker]:hidden">
      <span :class="cn('mr-1 inline-block text-muted-foreground transition-transform', open && 'rotate-90')">▸</span>
      <span v-if="label !== null" class="font-medium text-foreground">{{ label }}: </span>
      <span class="text-muted-foreground">
        {{ isArray ? "[ " : "{ " }}{{ jsonNodeSummary(value) }}{{ isArray ? " ]" : " }" }}
      </span>
    </summary>
    <!-- Children exist in the DOM only while open. -->
    <div v-if="open" class="ml-1.5 border-l border-border/60 pl-3.5">
      <JsonNode
        v-for="[k, v] in entries.slice(0, shown)"
        :key="k"
        :value="v"
        :label="k"
        :depth="depth + 1"
      />
      <button
        v-if="entries.length > shown"
        type="button"
        class="py-1 text-xs text-primary underline-offset-2 hover:underline"
        @click="shown += JSON_CHILD_CAP"
      >
        Show {{ Math.min(JSON_CHILD_CAP, entries.length - shown) }} more of {{ entries.length }}
      </button>
    </div>
  </details>
</template>
