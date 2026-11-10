<script setup lang="ts">
import { SquarePen } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Start a new chat. Sontara's ResetChatButton (icon-only to buy the row back,
 * with a real `aria-label` as well as the tooltip: a tooltip is not an
 * accessible name, and it does not exist at all on touch).
 */
defineProps<{ onNew: () => void; disabled?: boolean }>();
</script>

<template>
  <Tooltip>
    <TooltipTrigger as-child>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        :disabled="disabled"
        aria-label="New chat"
        class="size-8 shrink-0 rounded-full text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
        @click="onNew()"
      >
        <SquarePen class="size-4" aria-hidden="true" />
      </Button>
    </TooltipTrigger>
    <TooltipContent side="bottom" class="max-w-[14rem]">
      <p class="font-medium">New chat</p>
    </TooltipContent>
  </Tooltip>
</template>
