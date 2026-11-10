<script setup lang="ts">
import { useStateBinding } from "@json-render/vue";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const props = defineProps<{ title: string; description?: string | null; openPath: string }>();
// ponytail: openPath read once at setup (hooks bind a path); it is fixed per element.
const [open, setOpen] = useStateBinding<boolean>(props.openPath ?? "");
</script>

<template>
  <Dialog :open="open ?? false" @update:open="(v: boolean) => setOpen(v)">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{{ title }}</DialogTitle>
        <DialogDescription v-if="description">{{ description }}</DialogDescription>
      </DialogHeader>
      <slot />
    </DialogContent>
  </Dialog>
</template>
