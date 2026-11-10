<script setup lang="ts">
// Root: port of app/layout.tsx + app/theme-root.tsx + app/page.tsx.
//
// NO FLASH: the theme cookie is read on the SERVER (useCookie), and that
// theme's CSS vars are inlined into <style id="theme-vars"> via useHead so the
// very first paint is themed. ThemeVarsProvider rewrites the same <style> on a
// live switch (the head entry is static, so unhead never fights it). The
// 1.9 MB themes-full catalog is imported on the server only; the client gets
// the resolved Theme through the useState payload.
import { onMounted } from "vue";
import { useCookie, useHead, useState } from "#app";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import ChatApp from "@/components/app/chat-app.vue";
import ThemeVarsProvider from "@/components/theme/theme-vars-provider.vue";
import { COLOR_MODE_SCRIPT, useColorMode } from "@/components/theme/use-color-mode";
import { THEME_STYLE_ID, themeCss } from "@/lib/theme/theme-css";
import { THEME_COOKIE } from "@/lib/theme/theme-cookie";
import { THEME_WEBFONTS_HREF } from "@/lib/theme/theme-webfonts";
import type { Theme } from "@/lib/theme/themes";

const cookie = useCookie<string | null>(THEME_COOKIE, { decode: (v) => decodeURIComponent(String(v)) });
const theme = useState<Theme | null>("initial-theme", () => null);
if (import.meta.server) {
  const { themeByIdFull } = await import("@/lib/theme/themes-full");
  theme.value = themeByIdFull(cookie.value);
}
const initialTheme = theme.value!;

useHead({
  htmlAttrs: { lang: "en", class: "h-full antialiased" },
  bodyAttrs: { class: "h-full" },
  // Dark class before first paint (next-themes' inline script).
  script: [{ innerHTML: COLOR_MODE_SCRIPT, tagPriority: "critical" }],
  // bodyOpen, not head: it must come AFTER app.css so the theme beats its defaults
  // (React puts it in <body> for the same reason), and still before any content.
  style: [{ id: THEME_STYLE_ID, innerHTML: themeCss(initialTheme), tagPosition: "bodyOpen" }],
  link: [
    { rel: "preconnect", href: "https://fonts.gstatic.com", crossorigin: "anonymous" },
    { rel: "stylesheet", href: THEME_WEBFONTS_HREF },
  ],
});

const { installColorMode } = useColorMode();
onMounted(installColorMode);
</script>

<template>
  <ThemeVarsProvider :initial-theme="initialTheme">
    <TooltipProvider>
      <div class="h-dvh">
        <ChatApp />
      </div>
    </TooltipProvider>
  </ThemeVarsProvider>
  <Toaster />
</template>
