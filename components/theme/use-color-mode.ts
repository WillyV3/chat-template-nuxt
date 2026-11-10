// next-themes replacement (no new dep): `.dark` class on <html>, default
// "system", persisted in localStorage["theme"], no transition flash on change.
// The pre-paint script (COLOR_MODE_SCRIPT, injected by app.vue) sets the class
// before first paint so a stored/system dark mode never flashes light.
// resolvedTheme is undefined until `installColorMode()` runs on mount, exactly
// like next-themes, so SSR and first client render agree.

import { computed } from "vue";
import { useState } from "#app";

export type ColorMode = "light" | "dark" | "system";
const KEY = "theme";

export const COLOR_MODE_SCRIPT = `try{var t=localStorage.getItem("${KEY}");var d=t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);var e=document.documentElement;e.classList.toggle("dark",d);e.style.colorScheme=d?"dark":"light"}catch(e){}`;

function systemDark(): boolean {
  return matchMedia("(prefers-color-scheme: dark)").matches;
}

/** Apply the class, suppressing transitions for one frame (disableTransitionOnChange). */
function apply(mode: ColorMode, quiet: boolean): boolean {
  const dark = mode === "dark" || (mode === "system" && systemDark());
  const root = document.documentElement;
  let cleanup: (() => void) | undefined;
  if (quiet) {
    const style = document.createElement("style");
    style.appendChild(document.createTextNode("*,*::before,*::after{transition:none!important}"));
    document.head.appendChild(style);
    cleanup = () => {
      void getComputedStyle(document.body); // force reflow so the rule applies
      setTimeout(() => style.remove(), 1);
    };
  }
  root.classList.toggle("dark", dark);
  root.style.colorScheme = dark ? "dark" : "light";
  cleanup?.();
  return dark;
}

export function useColorMode() {
  const theme = useState<ColorMode>("color-mode", () => "system");
  const resolved = useState<"light" | "dark" | undefined>("color-mode-resolved", () => undefined);

  function setTheme(mode: ColorMode) {
    theme.value = mode;
    try {
      localStorage.setItem(KEY, mode);
    } catch {}
    resolved.value = apply(mode, true) ? "dark" : "light";
  }

  /** Call once from app.vue onMounted. */
  function installColorMode() {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(KEY);
    } catch {}
    theme.value = stored === "light" || stored === "dark" ? stored : "system";
    resolved.value = apply(theme.value, false) ? "dark" : "light";
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
      if (theme.value === "system") resolved.value = apply("system", true) ? "dark" : "light";
    });
    window.addEventListener("storage", (e: StorageEvent) => {
      if (e.key === KEY) {
        theme.value = e.newValue === "light" || e.newValue === "dark" ? e.newValue : "system";
        resolved.value = apply(theme.value, true) ? "dark" : "light";
      }
    });
  }

  return { theme, resolvedTheme: computed(() => resolved.value), setTheme, installColorMode };
}
