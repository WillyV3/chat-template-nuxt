<script setup lang="ts">
import type { HTMLAttributes } from "vue";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const props = defineProps<{
  src: string;
  name?: string;
  class?: HTMLAttributes["class"];
}>();
</script>

<template>
  <Avatar :class="cn('ring-border size-8 ring-1', props.class)">
    <AvatarImage alt="" class="mt-0 mb-0" :src="props.src" />
    <AvatarFallback>{{ props.name?.slice(0, 2) || "ME" }}</AvatarFallback>
  </Avatar>
</template>
