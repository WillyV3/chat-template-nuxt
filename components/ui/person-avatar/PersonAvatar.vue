<script setup lang="ts">
import { computed } from "vue"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

/**
 * A person's or agent's avatar, falling back to their initial.
 *
 * Moved out of `app/dashboard/agent/relay-panel.tsx` (764 lines) on
 * 2026-07-28. It is a UI primitive, and it had EIGHT importers — including
 * the dashboard grid and the @ picker — each of which was pulling an entire
 * relay feature module to get fourteen lines of avatar.
 *
 * A thin wrapper over the shared shadcn Avatar rather than a parallel
 * implementation: an earlier hand-rolled version rendered a raw <img> and
 * drifted from the rest of the app's avatars.
 */
const props = withDefaults(defineProps<{
  name: string
  src?: string | null
  size?: number
}>(), { size: 24 })

const initial = computed(() => (props.name || "?").trim().charAt(0).toUpperCase())
</script>

<template>
  <Avatar class="shrink-0" :style="{ width: `${size}px`, height: `${size}px` }">
    <AvatarImage v-if="src" :src="src" alt="" />
    <AvatarFallback
      class="bg-primary/15 font-medium text-primary"
      :style="{ fontSize: `${Math.max(9, Math.round(size * 0.45))}px` }"
    >
      {{ initial }}
    </AvatarFallback>
  </Avatar>
</template>
