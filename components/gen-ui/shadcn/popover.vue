<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

defineProps<{ trigger: string; content: string }>();
</script>

<template>
  <Popover>
    <PopoverTrigger as-child><Button variant="outline" class="text-sm">{{ trigger }}</Button></PopoverTrigger>
    <PopoverContent class="w-64"><p class="text-sm">{{ content }}</p></PopoverContent>
  </Popover>
</template>
