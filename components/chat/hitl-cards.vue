<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";

import HitlCard from "@/components/chat/hitl-card.vue";
import {
  adaptExecApproval,
  adaptMcpSetup,
  resolveAction,
  type HitlRequest,
} from "@/components/chat/hitl-cards";
import type { GatewayHook } from "@/components/chat/lib/use-gateway";

const props = defineProps<{ gateway: GatewayHook }>();

const requests = ref<HitlRequest[]>([]);

const remove = (p: { id: string }) => {
  requests.value = requests.value.filter((r) => r.id !== p.id);
};

// Legacy compat (image migration): render cards from OLD-image agents that
// still emit exec.approval.* / mcp.setup.*. Remove once the fleet is unified.
const onExecReq = (p: Record<string, unknown>) => {
  requests.value = [...requests.value, adaptExecApproval(p)];
};
const onMcpReq = (p: Record<string, unknown>) => {
  requests.value = [...requests.value, adaptMcpSetup(p)];
};
// One generic HITL path: every card (approvals, mcp setup, mode switch, ...)
// arrives as hitl.requested with its own actions[]; the backend owns the shape.
const onRequested = (payload: HitlRequest) => {
  requests.value = [...requests.value, payload];
};

// [event, handler] pairs, so subscribe and unsubscribe cannot drift apart.
const subscriptions: [string, (payload: never) => void][] = [
  ["exec.approval.requested", onExecReq],
  ["exec.approval.resolved", remove],
  ["mcp.setup.requested", onMcpReq],
  ["mcp.setup.resolved", remove],
  ["hitl.requested", onRequested],
  ["hitl.resolved", remove],
];

onMounted(() => {
  for (const [event, handler] of subscriptions) props.gateway.on(event, handler);
});
onBeforeUnmount(() => {
  for (const [event, handler] of subscriptions) props.gateway.off(event, handler);
});

function handleAction(id: string, action: string, values: Record<string, string>) {
  const request = requests.value.find((r) => r.id === id);
  if (!request) return;
  resolveAction(props.gateway.rpc, request, action, values);
  requests.value = requests.value.filter((r) => r.id !== id);
}
</script>

<template>
  <div v-if="requests.length > 0" class="mx-auto max-w-3xl space-y-2 px-4 py-2">
    <HitlCard v-for="req in requests" :key="req.id" :request="req" :on-action="handleAction" />
  </div>
</template>
