<script setup lang="ts">
// Message Actions (timestamp + copy + rewind).
import { computed, onBeforeUnmount, ref } from "vue";
import { Check, Copy, Pencil } from "@lucide/vue";

import { useNow30s } from "@/components/chat/hooks/use-now";
import { formatAbsoluteTime, formatRelativeTime } from "@/components/chat/core/message-format";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const props = defineProps<{
  text: string;
  createdAtMs?: number;
  align: "left" | "right";
  onRewind: () => void;
}>();

const copied = ref(false);
let copiedTimer: ReturnType<typeof setTimeout> | undefined;
onBeforeUnmount(() => clearTimeout(copiedTimer));

// One shared 30s clock re-renders every row for "just now"/"2m ago":
// previously each message ran its OWN interval (100 messages = 100 timers).
const now = useNow30s();
const relative = computed(() => formatRelativeTime(props.createdAtMs, now.value));

function handleCopy() {
  navigator.clipboard.writeText(props.text).then(() => {
    copied.value = true;
    copiedTimer = setTimeout(() => (copied.value = false), 1500);
  });
}
</script>

<template>
  <div
    :class="
      cn(
        'flex items-center gap-1 opacity-0 transition-opacity group-hover/msg:opacity-100',
        align === 'right' && 'flex-row-reverse',
      )
    "
  >
    <span
      v-if="createdAtMs"
      class="px-1 text-[10px] text-muted-foreground"
      :title="formatAbsoluteTime(createdAtMs)"
    >
      {{ relative }}
    </span>
    <Tooltip>
      <TooltipTrigger as-child>
        <Button
          variant="ghost"
          size="sm"
          class="size-6 p-0 text-muted-foreground hover:text-foreground"
          :aria-label="copied ? 'Copied' : 'Copy'"
          @click="handleCopy"
        >
          <Check v-if="copied" class="size-3" />
          <Copy v-else class="size-3" />
        </Button>
      </TooltipTrigger>
      <TooltipContent><p>{{ copied ? "Copied" : "Copy" }}</p></TooltipContent>
    </Tooltip>
    <Tooltip>
      <TooltipTrigger as-child>
        <Button
          variant="ghost"
          size="sm"
          class="size-6 p-0 text-muted-foreground hover:text-foreground"
          aria-label="Edit & resend"
          @click="onRewind"
        >
          <Pencil class="size-3" />
        </Button>
      </TooltipTrigger>
      <TooltipContent><p>Edit &amp; resend</p></TooltipContent>
    </Tooltip>
    <!-- The host's messageActions for this row, after copy and rewind. -->
    <slot />
  </div>
</template>
