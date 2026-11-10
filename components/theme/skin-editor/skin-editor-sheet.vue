<script setup lang="ts">
// The real skin CREATOR — replaces "share my current look as-is" (spec §7's
// original v1) with a tweakcn-style editor: pick a starting preset, tweak
// every token (34 colors x2 modes, 4 fonts, radius, letter-spacing), watch a
// live preview of real shadcn components, then submit through the
// SkinStore -> validateSkinPayload boundary. No raw-CSS field anywhere
// in this component tree — every control writes into the SAME fixed token
// map the security layer already enforces.
import { computed, ref } from "vue";
import { toast } from "vue-sonner";
import { Loader2Icon, PaletteIcon } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { THEMES, type Theme } from "@/lib/theme/themes";
import ThemeSwatchBar from "../theme-swatch-bar.vue";
import { validateSkinPayload } from "@/lib/theme/skins";
import { useSkinDraft, type SkinDraftMode } from "./use-skin-draft";
import ColorControls from "./color-controls.vue";
import TypographyControls from "./typography-controls.vue";
import RadiusControl from "./radius-control.vue";
import LetterSpacingControl from "./letter-spacing-control.vue";
import SkinEditorPreview from "./skin-editor-preview.vue";
import type { SkinStore } from "@/lib/theme/skin-store";

const CURRENT_PRESET_ID = "__current__";

const props = defineProps<{
  currentTheme: Theme;
  store: SkinStore;
  onSubmitted: () => void;
}>();

const open = ref(false);
const presetId = ref(THEMES.some((t) => t.id === props.currentTheme.id) ? props.currentTheme.id : CURRENT_PRESET_ID);
// Bumped every time the preset changes — used as a `key` on the controls
// column so ColorTokenField's internal hex/oklch draft state (initialized once
// from its `value` prop) resets cleanly instead of going stale when the
// underlying tokens are swapped out from under it.
const presetVersion = ref(0);
const mode = ref<SkinDraftMode>("light");
const submitting = ref(false);

const presetOptions = computed(() => [
  { id: CURRENT_PRESET_ID, label: `Current theme (${props.currentTheme.label})`, swatch: props.currentTheme.swatch },
  ...THEMES.map((t) => ({ id: t.id, label: t.label, swatch: t.swatch })),
]);

const { draft, swatch, setLabel, setColor, setRadius, setLetterSpacing, setFont, resetFromPreset } = useSkinDraft(
  props.currentTheme,
);

function handlePresetChange(id: string) {
  presetId.value = id;
  const theme = id === CURRENT_PRESET_ID ? props.currentTheme : THEMES.find((t) => t.id === id);
  if (theme) {
    resetFromPreset(theme);
    presetVersion.value++;
  }
}

async function handleSave() {
  const trimmedName = draft.value.label.trim();
  if (!trimmedName) {
    toast.error("Name it first.");
    return;
  }
  const payload = { ...draft.value, label: trimmedName, swatch: swatch.value };
  const validated = validateSkinPayload(payload);
  if (!validated.ok) {
    toast.error("Something's off with this skin", { description: validated.errors[0] });
    return;
  }
  submitting.value = true;
  try {
    await props.store.add(trimmedName, validated.data);
    toast.success("Skin saved.");
    open.value = false;
    props.onSubmitted();
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Couldn't save.");
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <Sheet v-model:open="open">
    <SheetTrigger as-child>
      <Button size="sm" class="h-8 shrink-0">
        <PaletteIcon class="mr-1 size-3.5" /> Create a skin
      </Button>
    </SheetTrigger>
    <SheetContent side="right" class="w-full gap-0 p-0 sm:max-w-none md:w-[95vw] lg:w-[1200px]">
      <SheetHeader class="border-b">
        <SheetTitle>Create a skin</SheetTitle>
        <SheetDescription>
          Start from a preset, tweak any color, font, radius or spacing, and watch the preview update live. Saved
          skins appear under My skins.
        </SheetDescription>
      </SheetHeader>

      <div class="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4 md:flex-row">
        <!-- Controls -->
        <div class="flex w-full shrink-0 flex-col gap-3 md:w-[380px]">
          <div class="space-y-1.5">
            <Label for="skin-editor-preset" class="text-xs text-muted-foreground">Start from</Label>
            <Select :model-value="presetId" @update:model-value="(v) => handlePresetChange(String(v))">
              <SelectTrigger id="skin-editor-preset" class="h-8 w-full text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="p in presetOptions" :key="p.id" :value="p.id">
                  <span class="flex items-center gap-2">
                    <ThemeSwatchBar :swatch="p.swatch" class="h-4 w-12 shrink-0 rounded-sm" />
                    {{ p.label }}
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div class="flex items-center justify-between rounded-md border px-3 py-2">
            <span class="text-xs font-medium">Editing</span>
            <div class="flex items-center gap-2 text-xs text-muted-foreground">
              <span :class="mode === 'light' ? 'text-foreground' : undefined">Light</span>
              <Switch
                :model-value="mode === 'dark'"
                aria-label="Edit dark-mode values"
                size="sm"
                @update:model-value="(checked) => (mode = checked ? 'dark' : 'light')"
              />
              <span :class="mode === 'dark' ? 'text-foreground' : undefined">Dark</span>
            </div>
          </div>

          <ScrollArea class="min-h-0 flex-1 rounded-md border">
            <div :key="presetVersion" class="space-y-4 p-3">
              <TypographyControls :font-key="draft.fontKey" :on-change-font="setFont" />
              <div class="space-y-3 border-b pb-4">
                <h4 class="text-sm font-medium">Radius &amp; spacing</h4>
                <RadiusControl :value="draft.light.radius ?? '0.5rem'" :on-change="setRadius" />
                <LetterSpacingControl :value="draft.light['letter-spacing'] ?? '0em'" :on-change="setLetterSpacing" />
              </div>
              <div class="space-y-1">
                <h4 class="text-sm font-medium">Colors ({{ mode }})</h4>
                <ColorControls :light="draft.light" :dark="draft.dark" :mode="mode" :on-change="setColor" />
              </div>
            </div>
          </ScrollArea>
        </div>

        <!-- Preview -->
        <div class="min-h-0 flex-1">
          <SkinEditorPreview :draft="draft" :dark="mode === 'dark'" :on-dark-change="(d) => (mode = d ? 'dark' : 'light')" />
        </div>
      </div>

      <SheetFooter class="flex-row items-center justify-between border-t">
        <div class="flex min-w-0 flex-1 items-center gap-2">
          <Label for="skin-editor-name" class="sr-only">Skin name</Label>
          <Input
            id="skin-editor-name"
            :model-value="draft.label"
            placeholder="Name your skin"
            :maxlength="40"
            :disabled="submitting"
            class="h-9"
            @update:model-value="(v) => setLabel(String(v))"
          />
        </div>
        <div class="flex shrink-0 gap-2">
          <SheetClose as-child>
            <Button variant="outline" :disabled="submitting">Cancel</Button>
          </SheetClose>
          <Button :disabled="submitting" @click="handleSave">
            <Loader2Icon v-if="submitting" class="mr-1 size-3.5 animate-spin" />
            Save skin
          </Button>
        </div>
      </SheetFooter>
    </SheetContent>
  </Sheet>
</template>
