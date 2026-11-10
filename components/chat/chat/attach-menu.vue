<script setup lang="ts">
// The paperclip's "save to…" menu: same trigger button, wrapped in a
// hand-rolled dropdown (not the shadcn DropdownMenu).
// Picking a destination opens the native file dialog for it via onPick.
import { onBeforeUnmount, ref, watch } from "vue";
import { Paperclip } from "@lucide/vue";

import Hint from "../ui/hint.vue";
import { InputGroupButton } from "@/components/ui/input-group";
import { ATTACH_DESTINATIONS } from "./attach-destinations";

const props = defineProps<{
  onPick: (dest: string) => void;
  disabled: boolean;
  hint: string;
}>();

const open = ref(false);
const rootRef = ref<HTMLElement | null>(null);

const onDown = (e: MouseEvent) => {
  if (rootRef.value && !rootRef.value.contains(e.target as Node)) open.value = false;
};
watch(open, (isOpen) => {
  if (isOpen) document.addEventListener("mousedown", onDown);
  else document.removeEventListener("mousedown", onDown);
});
onBeforeUnmount(() => document.removeEventListener("mousedown", onDown));
</script>

<template>
  <div ref="rootRef" class="relative">
    <div
      v-if="open"
      class="absolute bottom-9 left-0 z-30 w-40 rounded-xl border border-border bg-card p-1 shadow-lg"
    >
      <button
        v-for="d in ATTACH_DESTINATIONS"
        :key="d.path"
        type="button"
        class="flex w-full cursor-pointer items-center rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-accent"
        @click="
          open = false;
          props.onPick(d.path);
        "
      >
        {{ d.label }}
      </button>
    </div>
    <Hint :label="hint">
      <InputGroupButton
        size="icon-sm"
        :disabled="disabled"
        :aria-expanded="open"
        @click="open = !open"
      >
        <Paperclip />
      </InputGroupButton>
    </Hint>
  </div>
</template>
