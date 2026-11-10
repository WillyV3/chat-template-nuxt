<script setup lang="ts">
// See theme-vars.ts. Initial theme is a plain serializable prop the server
// already resolved (base or extra).
import { onMounted, provide, ref } from "vue";
import { toast } from "vue-sonner";
import type { Theme } from "@/lib/theme/themes";
import { themeCss, THEME_STYLE_ID } from "@/lib/theme/theme-css";
import { serializeThemeCookie, readThemeCookie } from "@/lib/theme/theme-cookie";
import { isSkinSlug, resolveSkinTheme } from "@/lib/theme/skins";
import { createLocalSkinStore, type SkinStore } from "@/lib/theme/skin-store";
import { THEME_VARS_KEY } from "./theme-vars";

const props = defineProps<{
  initialTheme: Theme;
  /** Optional: also persist the chosen theme id (e.g. to your DB). A throw or
   *  rejection reverts the pick, same as Sontara's failed PATCH did. */
  onSave?: (themeId: string) => Promise<void>;
  /** Where saved skins live; only used to re-apply a `skin-*` cookie on mount
   *  (the server can't see browser-local skins). Defaults to localStorage. */
  skinStore?: SkinStore;
}>();

/** Rewrite the server-rendered <style> with a theme's vars. Creates the element
 *  defensively if it's somehow absent (it never is under normal SSR). */
function applyThemeVars(theme: Theme): void {
  if (typeof document === "undefined") return;
  let el = document.getElementById(THEME_STYLE_ID) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement("style");
    el.id = THEME_STYLE_ID;
    document.head.appendChild(el);
  }
  el.textContent = themeCss(theme);
}

const themeId = ref(props.initialTheme.id);
const saving = ref(false);
// Guards against a slow save being overtaken by a newer pick.
let latest = props.initialTheme.id;
// The full theme currently on screen — kept so a failed save reverts to the
// exact previous theme (base OR extra), not a re-lookup by id.
let applied: Theme = props.initialTheme;

// A saved skin lives in the browser, so the server rendered the default for
// it. Re-apply from the skin store once mounted.
onMounted(() => {
  const id = readThemeCookie(document.cookie);
  if (!id || !isSkinSlug(id) || id === applied.id) return;
  (props.skinStore ?? createLocalSkinStore(localStorage)).list().then((rows) => {
    const row = rows.find((r) => r.slug === id);
    const theme = row && resolveSkinTheme(row);
    if (!theme || applied.id === id || latest !== props.initialTheme.id) return;
    latest = id;
    applied = theme;
    themeId.value = id;
    applyThemeVars(theme);
  });
});

function setTheme(theme: Theme) {
  const target = theme.id;
  if (target === applied.id) return;
  const previous = applied;
  latest = target;
  applied = theme;
  themeId.value = target;
  applyThemeVars(theme); // live, no reload
  saving.value = true;
  Promise.resolve()
    .then(() => {
      document.cookie = serializeThemeCookie(target);
      return props.onSave?.(target);
    })
    .catch(() => {
      // Only roll back if this is still the active pick.
      if (latest !== target) return;
      document.cookie = serializeThemeCookie(previous.id);
      applied = previous;
      themeId.value = previous.id;
      applyThemeVars(previous);
      toast.error("Couldn't save theme", { description: "Reverted. Try again." });
    })
    .finally(() => {
      if (latest === target) saving.value = false;
    });
}

provide(THEME_VARS_KEY, { themeId, setTheme, saving });
</script>

<template>
  <slot />
</template>
