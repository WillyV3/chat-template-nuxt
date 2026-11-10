<script setup lang="ts">
// Appearance settings — the theme picker (YOU → Appearance). A gallery of the
// whole catalog; clicking a card applies the theme LIVE (ThemeVarsProvider
// rewrites the root style element) and persists (cookie + optional onSave). The
// swatch bar IS the preview — no faux screenshots, no gradients.
//
// LAZY CATALOG: the 40 base themes ship in the bundle (lib/themes), but the
// ~1000 extra themes (lib/themes-extra, ~1.9 MB) are DYNAMIC-imported once this
// panel mounts, so they land in their OWN async chunk — never in the main/client
// bundle or the website builder. Until that chunk resolves the picker shows the
// base themes; then the full set fills in. A search field keeps 700+ cards
// fast; the panel itself scrolls.
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { Palette, RotateCcw, Search } from "@lucide/vue";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { THEMES, DEFAULT_THEME_ID, themeById, type Theme } from "@/lib/theme/themes";
import type { SkinStore } from "@/lib/theme/skin-store";
import { useThemeVars } from "./theme-vars";
import ThemeTileGrid from "./theme-tile-grid.vue";
import MySkinsTab from "./my-skins-tab.vue";

defineProps<{ skinStore?: SkinStore }>();

/** Gallery lead order — the hand-crafted skins + 8-Bit first, in this order. */
const FEATURED_IDS = ["default", "sontara-neon", "winamp", "terminal", "vapor", "solarium", "eight-bit"];
/** Plain shadcn neutral bases — correct but boring, so they sort last. */
const DEMOTED_IDS = new Set([
  "zinc", "slate", "stone", "gray", "neutral", "red", "rose", "orange",
  "green", "blue", "yellow", "violet",
]);

const { themeId, setTheme, saving } = useThemeVars();
const query = ref("");
// Extra catalog: loaded lazily so its ~1.9 MB never enters the main bundle.
const extra = ref<Theme[]>([]);

let alive = true;
onMounted(() => {
  // Dynamic import → separate chunk, fetched only when the picker is open.
  import("@/lib/theme/themes-extra")
    .then((m) => {
      if (alive) extra.value = m.EXTRA_THEMES;
    })
    .catch(() => {
      /* Base themes still work; extra just won't appear. */
    });
});
onBeforeUnmount(() => {
  alive = false;
});

// Order the gallery so the good stuff leads: hand-crafted skins + the 8-Bit
// one first (Willy: "the ones you made are doper than the premade ones"), the
// plain zinc/slate/etc. neutral bases last, everything else in between.
const all = computed(() => {
  const merged = [...THEMES, ...extra.value];
  const byId = new Map(merged.map((t) => [t.id, t]));
  const featured = FEATURED_IDS.map((id) => byId.get(id)).filter((t): t is Theme => Boolean(t));
  const featuredSet = new Set(FEATURED_IDS);
  const middle = merged.filter((t) => !featuredSet.has(t.id) && !DEMOTED_IDS.has(t.id));
  const demoted = merged.filter((t) => DEMOTED_IDS.has(t.id));
  return [...featured, ...middle, ...demoted];
});
const current = computed(() => all.value.find((t) => t.id === themeId.value) ?? themeById(themeId.value));
const defaultTheme = themeById(DEFAULT_THEME_ID);

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return all.value;
  return all.value.filter((t) => t.label.toLowerCase().includes(q) || t.id.includes(q));
});
</script>

<template>
  <Card>
    <CardHeader class="p-4 pb-2">
      <CardTitle class="flex items-center gap-2 text-sm">
        <Palette class="size-4" /> Skins
      </CardTitle>
      <CardDescription class="text-xs">
        Change how the app looks — pick a skin. It applies right away and is
        remembered; colors AND fonts change, in light and dark.
      </CardDescription>
    </CardHeader>
    <CardContent class="p-4 pt-2">
      <Tabs default-value="catalog">
        <TabsList>
          <TabsTrigger value="catalog">Catalog</TabsTrigger>
          <TabsTrigger value="mine">My skins</TabsTrigger>
        </TabsList>

        <TabsContent value="catalog" class="space-y-3">
          <!-- Toolbar: search + current + reset -->
          <div class="flex flex-wrap items-center gap-2">
            <div class="relative min-w-0 flex-1">
              <Search class="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input v-model="query" placeholder="Search skins…" aria-label="Search skins" class="h-8 bg-background pl-8 text-sm" />
            </div>
            <Button
              variant="outline"
              size="sm"
              class="h-8 shrink-0"
              :disabled="saving || themeId === DEFAULT_THEME_ID"
              @click="setTheme(defaultTheme)"
            >
              <RotateCcw class="mr-1 size-3.5" /> Reset to default
            </Button>
          </div>

          <ThemeTileGrid
            :themes="filtered"
            :selected-id="themeId"
            :on-select="setTheme"
            :disabled="saving"
            :empty-message="`No skins match &quot;${query}&quot;.`"
          />

          <!-- Status row -->
          <div class="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>
              Current: <span class="font-medium text-foreground">{{ current.label }}</span>
            </span>
            <span>{{ saving ? "Saving…" : `${all.length} skins` }}</span>
          </div>
        </TabsContent>

        <TabsContent value="mine">
          <MySkinsTab :current-theme="current" :theme-id="themeId" :on-select="setTheme" :saving="saving" :store="skinStore" />
        </TabsContent>
      </Tabs>
    </CardContent>
  </Card>
</template>
