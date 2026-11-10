<script setup lang="ts">
// JSON renders as a tap-to-expand tree, not a wall of highlighted source
// (Willy 2026-08-09: "reading big json files on mobile sux"). Closed nodes
// mount NO children — a huge file only ever paints what's open — and long
// values wrap instead of forcing horizontal scroll. Native <details> supplies
// collapse a11y/behavior; Vue controls `open` so children stay unmounted
// until first toggle.
import { computed } from "vue"
import CodeRenderer from "./code-renderer.vue"
import JsonNode from "./json-node.vue"
import { parseJsonDocument } from "./viewer-model"

const props = defineProps<{ text: string; name: string }>()
const value = computed(() => parseJsonDocument(props.text, props.name))
</script>

<template>
  <!-- Not valid JSON → the old behavior (highlighted source) is the right one. -->
  <CodeRenderer v-if="value === undefined" :text="text" lang="json" />
  <div v-else class="px-4 py-4 font-mono text-xs leading-relaxed sm:px-6 sm:text-sm">
    <JsonNode :value="value" :label="null" :depth="0" />
  </div>
</template>
