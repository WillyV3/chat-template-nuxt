<script setup lang="ts">
// The transcript's single dispatch point: first registered kind whose gate
// passes renders the row. A row with no registered kind renders nothing.
// Everything besides `msg` / `renderers` (the MessageRenderContext, host
// context included) is forwarded to the renderer's component as props.
import { computed } from "vue"
import { entryFor, type AnyRow, type Renderers } from "./renderers"

defineOptions({ inheritAttrs: false })
const props = defineProps<{
  msg: AnyRow
  renderers: Renderers<AnyRow, object>
}>()

const hit = computed(() => entryFor(props.msg, props.renderers))
</script>

<template>
  <component :is="hit.entry.Component" v-if="hit" v-bind="$attrs" :msg="msg" />
</template>
