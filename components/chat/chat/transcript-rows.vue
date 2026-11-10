<script setup lang="ts">
// The expensive half of the transcript (every message's markdown). Vue skips a
// child's re-render unless one of its props changed by identity, which is the
// job React.memo did: a keystroke that re-rendered every row is what killed
// the tab mid-sentence on a long conversation (report 230cdb93, 2026-10-16).
// Every prop here must stay referentially stable across keystrokes.
import { computed } from "vue"
import { groupToolRuns } from "@/components/chat/core/group-tool-runs"

import { isSpecialToolRow, type AnyRow } from "./renderers"
import type { RowsProps } from "./chat-transcript"
import TranscriptMessage from "./transcript-message.vue"
import ToolRunGroup from "./tool-run-group.vue"

const props = defineProps<RowsProps<AnyRow, object>>()

// Consecutive tool rows fold into one line (groupToolRuns) unless a row has a
// dedicated card (isSpecialToolRow reads the SAME registry TranscriptMessage
// dispatches through, so folding can't drift from what renders). A group is a
// wrapper, never a filter: same rows either way.
const items = computed(() =>
  groupToolRuns(props.messages, (m) => !isSpecialToolRow(m, props.renderers)),
)

const rowProps = (msg: AnyRow) => ({
  ...props.context,
  msg,
  agentUrl: props.agentUrl,
  token: props.token,
  containerWidth: props.containerWidth,
  onRewind: props.onRewind,
  onOpenFile: props.onOpenFile,
  orbFor: props.orbFor,
  glyphs: props.glyphs,
  actions: props.actionsFor?.(msg),
  renderers: props.renderers,
})
</script>

<template>
  <template v-for="item in items" :key="item.kind === 'message' ? item.message.id : item.id">
    <TranscriptMessage v-if="item.kind === 'message'" v-bind="rowProps(item.message)" />
    <ToolRunGroup v-else :messages="item.messages" :tables="tables" :orb-for="orbFor">
      <TranscriptMessage v-for="m in item.messages" :key="m.id" v-bind="rowProps(m)" />
    </ToolRunGroup>
  </template>
</template>
