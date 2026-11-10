// Live theme application — context + composable. The provider component is
// theme-vars-provider.vue. The SERVER (app.vue) has already rendered a
// <style id="theme-vars"> from the theme cookie before first paint — no flash.
// The provider only comes into play when the picker changes the theme: it
// rewrites that same <style> element (both light + dark rules, so it keeps
// composing with the `.dark` class) and persists the choice: a cookie always,
// plus the optional `onSave` so an app can mirror it into its own DB.
//
// It works on the RESOLVED Theme OBJECT, not an id, on purpose: the extra
// catalog (~1000 themes) is lazy — the picker dynamic-imports it and hands the
// full theme to setTheme — so the client never needs to statically import
// that big module to look a theme up by id.

import { inject, type InjectionKey, type Ref } from "vue";
import { DEFAULT_THEME_ID, type Theme } from "@/lib/theme/themes";

export interface ThemeVarsContextValue {
  /** Currently applied theme id. */
  themeId: Readonly<Ref<string>>;
  /** Apply a theme live + persist it. Optimistic; reverts on save failure.
   *  Takes the full resolved Theme so extra (lazy) themes apply without this
   *  provider importing the big catalog. */
  setTheme: (theme: Theme) => void;
  /** True while a save is in flight. */
  saving: Readonly<Ref<boolean>>;
}

export const THEME_VARS_KEY: InjectionKey<ThemeVarsContextValue> = Symbol("theme-vars");

/** Read the active theme + switch it. Must be used inside ThemeVarsProvider. */
export function useThemeVars(): ThemeVarsContextValue {
  const ctx = inject(THEME_VARS_KEY, null);
  if (!ctx) {
    throw new Error("useThemeVars must be used within ThemeVarsProvider");
  }
  return ctx;
}

export { DEFAULT_THEME_ID };
