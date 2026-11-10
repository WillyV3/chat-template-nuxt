<script setup lang="ts">
// EXAMPLE right panel: whatever context sits beside the chat in your app
// (sources, a record being discussed, settings for this conversation).
// ChatShell gives it a drag-resizable, independently scrolling column.

import type { Conversation } from "./conversations";

defineProps<{ conversation: Conversation; assistant: string }>();
</script>

<template>
  <div class="flex flex-col gap-6 p-4">
    <section>
      <h3 class="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Conversation</h3>
      <div class="flex items-baseline justify-between gap-4 py-1.5 text-sm">
        <span class="text-muted-foreground">Title</span>
        <span class="truncate text-right">{{ conversation.title }}</span>
      </div>
      <div class="flex items-baseline justify-between gap-4 py-1.5 text-sm">
        <span class="text-muted-foreground">Assistant</span>
        <span class="truncate text-right">{{ assistant }}</span>
      </div>
      <div class="flex items-baseline justify-between gap-4 py-1.5 text-sm">
        <span class="text-muted-foreground">Backend</span>
        <span class="truncate text-right"><code class="text-xs">lib/mock-gateway.ts</code></span>
      </div>
    </section>
    <section>
      <h3 class="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Make it yours</h3>
      <ul class="list-disc space-y-1.5 pl-4 text-sm text-muted-foreground">
        <li>Connect a real agent: pass <code class="text-xs">useGateway(url, token)</code> as the room's gateway.</li>
        <li>Replace this panel: <code class="text-xs">components/app/details-panel.vue</code>.</li>
        <li>Replace the rail: <code class="text-xs">components/app/rail.vue</code>.</li>
      </ul>
    </section>
  </div>
</template>
