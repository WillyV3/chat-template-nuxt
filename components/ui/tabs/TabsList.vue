<script setup lang="ts">
import type { TabsListProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { cn } from "@/lib/utils"
import { TabsList } from "reka-ui"
import type { TabsListVariants } from "."
import { tabsListVariants } from "."

const props = defineProps<TabsListProps & { class?: HTMLAttributes["class"], variant?: TabsListVariants["variant"] }>()

const delegatedProps = reactiveOmit(props, "class", "variant")
</script>

<template>
  <TabsList
    data-slot="tabs-list"
    v-bind="delegatedProps"
    :data-variant="props.variant ?? 'default'"
    :class="cn(tabsListVariants({ variant: props.variant }), props.class)"
  >
    <slot />
  </TabsList>
</template>
