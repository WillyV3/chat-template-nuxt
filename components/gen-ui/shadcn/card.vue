<script setup lang="ts">
import { computed } from "vue";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const props = defineProps<{
  title?: string | null;
  description?: string | null;
  maxWidth?: "sm" | "md" | "lg" | "full" | null;
  centered?: boolean | null;
  className?: string | null;
}>();
const cls = computed(() =>
  cn(
    props.maxWidth === "sm"
      ? "max-w-xs sm:min-w-[280px]"
      : props.maxWidth === "md"
        ? "max-w-sm sm:min-w-[320px]"
        : props.maxWidth === "lg"
          ? "max-w-md sm:min-w-[360px]"
          : "w-full",
    props.centered ? "mx-auto" : "",
    props.className,
  ),
);
</script>

<template>
  <Card :class="cls">
    <CardHeader v-if="title || description">
      <CardTitle v-if="title">{{ title }}</CardTitle>
      <CardDescription v-if="description">{{ description }}</CardDescription>
    </CardHeader>
    <CardContent class="flex flex-col gap-3"><slot /></CardContent>
  </Card>
</template>
