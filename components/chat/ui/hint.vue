<script setup lang="ts">
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * A tooltip for an icon-only control, in one line.
 *
 * Replaces native `title=""`, which was used in ~10 places. `title` never
 * appears on touch (there is no hover), can't be styled, and shows up on the
 * OS's own schedule, so on a phone those buttons were unlabelled pictograms.
 *
 * The label doubles as the accessible name, so the trigger stops needing a
 * separate aria-label that can drift out of sync with what's displayed.
 *
 * Requires a TooltipProvider mounted above (app.vue). reka-ui allows nesting,
 * so the sidebar's own provider keeps working.
 */
withDefaults(
  defineProps<{
    label: string;
    side?: "top" | "right" | "bottom" | "left";
  }>(),
  { side: "top" },
);
</script>

<template>
  <Tooltip>
    <TooltipTrigger as-child :aria-label="label">
      <slot />
    </TooltipTrigger>
    <TooltipContent :side="side">{{ label }}</TooltipContent>
  </Tooltip>
</template>
