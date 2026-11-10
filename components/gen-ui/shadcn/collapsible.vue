<script setup lang="ts">
import { ref } from "vue";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const props = defineProps<{ title: string; defaultOpen?: boolean | null }>();
const open = ref(props.defaultOpen ?? false);
</script>

<template>
  <Collapsible v-model:open="open" class="w-full">
    <CollapsibleTrigger as-child>
      <button class="flex w-full items-center justify-between rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors">
        {{ title }}
        <svg :class="`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
    </CollapsibleTrigger>
    <CollapsibleContent class="pt-2"><slot /></CollapsibleContent>
  </Collapsible>
</template>
