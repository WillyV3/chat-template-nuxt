<script setup lang="ts">
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

defineProps<{ content: string; text: string }>();
</script>

<template>
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger as-child><span class="text-sm underline decoration-dotted cursor-help">{{ text }}</span></TooltipTrigger>
      <TooltipContent><p>{{ content }}</p></TooltipContent>
    </Tooltip>
  </TooltipProvider>
</template>
