<script setup lang="ts">
// "My skins": create a custom skin with the tweakcn-style editor
// (SkinEditorSheet) and apply/delete what you've saved. PORTABILITY CUT: in
// Sontara this listed server-side submissions with review status via
// /api/skins; here skins live in a SkinStore (localStorage by default), so
// there is no moderation status and a saved skin is directly applicable.
import { computed, onMounted, ref } from "vue";
import { toast } from "vue-sonner";
import { Trash2Icon } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import SkinEditorSheet from "./skin-editor/skin-editor-sheet.vue";
import ThemeTileGrid from "./theme-tile-grid.vue";
import { createLocalSkinStore, skinThemes, type SkinStore } from "@/lib/theme/skin-store";
import type { SkinRow } from "@/lib/theme/skins";
import type { Theme } from "@/lib/theme/themes";

const props = defineProps<{
  currentTheme: Theme;
  themeId: string;
  onSelect: (theme: Theme) => void;
  saving: boolean;
  store?: SkinStore;
}>();

// Mounted client-side only (localStorage); the store is created on first use.
let localStore: SkinStore | undefined;
const store = (): SkinStore => props.store ?? (localStore ??= createLocalSkinStore(localStorage));
const rows = ref<SkinRow[]>([]);
const loading = ref(true);

// Reused for the post-save refresh.
async function load() {
  try {
    rows.value = await store().list();
  } catch {
    toast.error("Couldn't load your skins");
  } finally {
    loading.value = false;
  }
}

onMounted(load);

const themes = computed(() => skinThemes(rows.value));

async function remove(slug: string) {
  try {
    await store().remove(slug);
    await load();
  } catch {
    toast.error("Couldn't delete skin");
  }
}
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center justify-between gap-2">
      <p class="max-w-[70%] text-xs text-muted-foreground">
        Build your own skin — colors, fonts, radius, everything.
      </p>
      <!-- Keyed by the applied theme's id: if it changes elsewhere while this
           tab is mounted, the editor remounts fresh instead of reopening
           with a stale snapshot. -->
      <SkinEditorSheet :key="currentTheme.id" :current-theme="currentTheme" :store="store()" :on-submitted="load" />
    </div>

    <p v-if="loading" class="py-6 text-center text-xs text-muted-foreground">Loading…</p>
    <template v-else>
      <ThemeTileGrid
        :themes="themes"
        :selected-id="themeId"
        :on-select="onSelect"
        :disabled="saving"
        empty-message="You haven't saved a skin yet."
      />
      <ul v-if="themes.length > 0" class="space-y-1">
        <li v-for="t in themes" :key="t.id" class="flex items-center justify-between text-xs">
          <span class="truncate">{{ t.label }}</span>
          <Button variant="ghost" size="sm" class="h-7" :aria-label="`Delete ${t.label}`" @click="remove(t.id)">
            <Trash2Icon class="size-3.5" />
          </Button>
        </li>
      </ul>
    </template>
  </div>
</template>
