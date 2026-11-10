<script setup lang="ts">
// Render a spec with this catalog, anywhere (not just chat):
//   <GenUI :spec="spec" :handlers="{ send_message: (p) => ... }" />
import { JSONUIProvider, Renderer, type Spec } from "@json-render/vue";
import { registry } from "./registry";

defineProps<{
  spec: Spec | null;
  loading?: boolean;
  handlers?: Record<string, (params: Record<string, unknown>) => unknown>;
}>();
</script>

<template>
  <JSONUIProvider :registry="registry" :handlers="handlers">
    <Renderer :spec="spec" :registry="registry" :loading="loading" />
  </JSONUIProvider>
</template>
