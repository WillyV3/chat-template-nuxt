<script setup lang="ts">
// Font-family + radius + letter-spacing — the non-color half of the token
// surface. Kept as always-visible compact panels (not accordion items): only
// 4 font slots and 2 sliders, nothing here needs progressive disclosure the
// way 34 color tokens do. (Radius/LetterSpacing controls: sibling files.)
import FontSelectField from "./font-select-field.vue";
import { FONT_SLOT_LABELS, SKIN_FONT_SLOTS } from "./token-schema";
import type { SkinPayloadDraft } from "@/lib/theme/skin-submit";

defineProps<{
  fontKey: SkinPayloadDraft["fontKey"];
  onChangeFont: (slot: (typeof SKIN_FONT_SLOTS)[number], value: string) => void;
}>();
</script>

<template>
  <div class="space-y-3 border-b pb-4">
    <h4 class="text-sm font-medium">Typography</h4>
    <FontSelectField
      v-for="slot in SKIN_FONT_SLOTS"
      :key="slot"
      :slot-key="slot"
      :label="FONT_SLOT_LABELS[slot]"
      :value="fontKey[slot]"
      :on-change="(v: string) => onChangeFont(slot, v)"
    />
  </div>
</template>
