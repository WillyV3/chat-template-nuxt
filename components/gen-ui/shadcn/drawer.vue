<script setup lang="ts">
import { useStateBinding } from "@json-render/vue";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";

const props = defineProps<{ title: string; description?: string | null; openPath: string }>();
const [open, setOpen] = useStateBinding<boolean>(props.openPath ?? "");
</script>

<template>
  <Drawer :open="open ?? false" @update:open="(v: boolean) => setOpen(v)">
    <DrawerContent>
      <DrawerHeader>
        <DrawerTitle>{{ title }}</DrawerTitle>
        <DrawerDescription v-if="description">{{ description }}</DrawerDescription>
      </DrawerHeader>
      <div class="p-4"><slot /></div>
    </DrawerContent>
  </Drawer>
</template>
