<script setup lang="ts">
// One editable color token — the row unit the whole "Colors" accordion is
// built from. No hand-rolled picker chrome: the actual color-picking surface
// is the browser's NATIVE <input type="color"> (there is no color-picker
// primitive under components/ui/ — checked; a native swatch button wrapped in
// the shadcn Popover + Label/Input pattern is the smallest well-known
// approach, not a new dependency). Hex and oklch are two synced text
// representations of the SAME value, converted with lib/theme/color-convert.ts;
// whichever the user typed last wins until it fails to parse.
import { ref } from "vue";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { hexToOklch, oklchToHex, parseHex, rgbToHex, isParseableOklch } from "@/lib/theme/color-convert";

const props = defineProps<{
  tokenKey: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
}>();

/** Normalize ANY currently-stored value (hex, oklch(), hsl(), a keyword) to
 *  the full 6-digit #rrggbb the native <input type="color"> requires — it
 *  rejects 3-digit shorthand, 8-digit alpha hex, and anything else outright.
 *  Falls back to a neutral gray for a value the picker genuinely can't
 *  represent (e.g. "transparent") rather than showing nothing. */
function toNativeSwatchValue(value: string): string {
  const rgb = parseHex(value);
  if (rgb) return rgbToHex(rgb);
  if (isParseableOklch(value)) {
    const hex = oklchToHex(value);
    if (hex) return hex;
  }
  return "#888888";
}

const hexDraft = ref(parseHex(props.value) ? props.value : oklchToHex(props.value) ?? "");
const oklchDraft = ref(isParseableOklch(props.value) ? props.value : hexToOklch(props.value) ?? "");

function commitHex(next: string) {
  hexDraft.value = next;
  if (parseHex(next)) {
    props.onChange(next);
    const oklch = hexToOklch(next);
    if (oklch) oklchDraft.value = oklch;
  }
}

function commitOklch(next: string) {
  oklchDraft.value = next;
  const hex = oklchToHex(next);
  if (hex) {
    props.onChange(next); // store the oklch() form the user typed, not a lossy hex round-trip
    hexDraft.value = hex;
  }
}

function fromSwatch(hex: string) {
  hexDraft.value = hex;
  props.onChange(hex);
  const oklch = hexToOklch(hex);
  if (oklch) oklchDraft.value = oklch;
}
</script>

<template>
  <div class="flex items-start gap-2">
    <Popover>
      <PopoverTrigger as-child>
        <button
          type="button"
          :aria-label="label"
          class="size-7 shrink-0 rounded-md border border-border shadow-xs"
          :style="{ background: value }"
        />
      </PopoverTrigger>
      <PopoverContent class="w-auto p-2" align="start">
        <input
          type="color"
          :aria-label="`${label} — pick a color`"
          :value="toNativeSwatchValue(value)"
          class="size-32 cursor-pointer border-0 bg-transparent p-0"
          @input="fromSwatch(($event.target as HTMLInputElement).value)"
        />
      </PopoverContent>
    </Popover>
    <div class="min-w-0 flex-1 space-y-1">
      <Label :for="`${tokenKey}-hex`" class="sr-only">{{ label }} — hex</Label>
      <Input
        :id="`${tokenKey}-hex`"
        :model-value="hexDraft"
        placeholder="#000000"
        class="h-7 font-mono text-xs"
        :maxlength="9"
        @update:model-value="(v) => commitHex(String(v))"
      />
      <Label :for="`${tokenKey}-oklch`" class="sr-only">{{ label }} — oklch</Label>
      <Input
        :id="`${tokenKey}-oklch`"
        :model-value="oklchDraft"
        placeholder="oklch(0.6 0.2 260)"
        class="h-7 font-mono text-xs"
        :maxlength="40"
        @update:model-value="(v) => commitOklch(String(v))"
      />
    </div>
  </div>
</template>
