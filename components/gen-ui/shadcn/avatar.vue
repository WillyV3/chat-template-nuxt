<script setup lang="ts">
import { computed } from "vue";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const props = defineProps<{ src?: string | null; name: string; size?: "sm" | "md" | "lg" | null }>();
const name = computed(() => props.name || "?");
const initials = computed(() => name.value.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase());
const sizeClass = computed(() => (props.size === "lg" ? "h-12 w-12" : props.size === "sm" ? "h-8 w-8" : "h-10 w-10"));
</script>

<template>
  <Avatar :class="sizeClass">
    <AvatarImage v-if="src" :src="src" :alt="name" />
    <AvatarFallback>{{ initials }}</AvatarFallback>
  </Avatar>
</template>
