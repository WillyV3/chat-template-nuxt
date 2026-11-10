<script setup lang="ts">
// THE nav item for every sidebar — one treatment, no drift.
// Hover is pure CSS (icon nudge + label shift — zero JS per frame, Willy's
// "super fast and light"). The ONE motion element is the active pill that
// springs between items via layoutId — the only part CSS can't do. Canvas
// effects deliberately absent: those are for moments (welcome, landing),
// not persistent chrome.

import type { Component } from "vue"
import { NuxtLink } from "#components"
import { motion } from "motion-v"
import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

const props = withDefaults(defineProps<{
  // Structural, not a lucide type: the brand PiMark is a plain SVG component,
  // not a lucide export, and it belongs in nav like any other icon.
  icon: Component
  label: string
  isActive?: boolean
  /** Same pillId across a list = the active pill springs between its items. */
  pillId: string
  href?: string
  onClick?: () => void
  disabled?: boolean
  /** Tint just the icon with the brand colour. Chat uses it so the π mark is
   *  the one coloured icon in the rail (Willy 2026-07-27) — an accent means
   *  nothing if everything has one. Kept as an opt-in flag rather than
   *  special-casing PiMark in here, so the rail doesn't need to know which
   *  component it was handed. */
  accentIcon?: boolean
}>(), { isActive: false, accentIcon: false })

const iconClass = cn(
  "relative z-10 transition-transform duration-200 ease-out group-hover/nav:-rotate-3 group-hover/nav:scale-110",
  // Explicit on hover/active too: SidebarMenuButton sets
  // hover:text-sidebar-accent-foreground on the whole button, which
  // would otherwise drag the tint back to the default on hover.
  props.accentIcon && "text-primary group-hover/nav:text-primary",
)

// The motion pill replaces the static active background; keep hover tint.
const buttonClass = cn("group/nav relative data-[active=true]:bg-transparent")
</script>

<template>
  <SidebarMenuItem>
    <SidebarMenuButton v-if="href" as-child :is-active="isActive" :tooltip="label" :class="buttonClass">
      <NuxtLink :to="href">
        <motion.span
          v-if="isActive"
          :layout-id="pillId"
          class="absolute inset-0 rounded-md bg-sidebar-accent"
          :transition="{ type: 'spring', stiffness: 520, damping: 38 }"
          aria-hidden="true"
        />
        <component :is="icon" :class="iconClass" />
        <span class="relative z-10 transition-transform duration-200 ease-out group-hover/nav:translate-x-0.5">
          {{ label }}
        </span>
        <span v-if="$slots.badge" class="relative z-10 ml-auto"><slot name="badge" /></span>
      </NuxtLink>
    </SidebarMenuButton>
    <SidebarMenuButton
      v-else
      :is-active="isActive"
      :tooltip="label"
      :disabled="disabled"
      :class="buttonClass"
      @click="onClick?.()"
    >
      <motion.span
        v-if="isActive"
        :layout-id="pillId"
        class="absolute inset-0 rounded-md bg-sidebar-accent"
        :transition="{ type: 'spring', stiffness: 520, damping: 38 }"
        aria-hidden="true"
      />
      <component :is="icon" :class="iconClass" />
      <span class="relative z-10 transition-transform duration-200 ease-out group-hover/nav:translate-x-0.5">
        {{ label }}
      </span>
      <span v-if="$slots.badge" class="relative z-10 ml-auto"><slot name="badge" /></span>
    </SidebarMenuButton>
  </SidebarMenuItem>
</template>
