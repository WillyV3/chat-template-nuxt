<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useBound } from "./use-bound";

const props = defineProps<{
  label: string;
  items: { label: string; value: string }[];
  value?: string | null;
  bindings?: Record<string, string>;
  emit: (event: string) => void;
}>();
// Write-only, like React: the menu shows `label`, the pick lands in the bound path.
const value = useBound<string>(() => props.value, () => props.bindings?.value, "", () => "");
function pick(v: string) {
  value.value = v;
  props.emit("select");
}
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child><Button variant="outline">{{ label }}</Button></DropdownMenuTrigger>
    <DropdownMenuContent>
      <DropdownMenuItem v-for="item in items ?? []" :key="item.value" @select="pick(item.value)">{{ item.label }}</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
