import tailwindcss from "@tailwindcss/vite";

// Same tree as the React template: srcDir is the repo root, `@/` = root.
// Auto-imports are OFF: every file imports what it uses, like the React side.
export default defineNuxtConfig({
  compatibilityDate: "2026-10-01",
  srcDir: ".",
  devtools: { enabled: false },
  components: { dirs: [] },
  imports: { autoImport: false },
  css: ["@/app.css"],
  vite: { plugins: [tailwindcss()] },
  app: {
    head: {
      title: "Chat Template",
      meta: [{ name: "description", content: "A chat app shell: left rail, chat, right panel. Bring your own backend." }],
      link: [
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        { rel: "preconnect", href: "https://fonts.gstatic.com", crossorigin: "anonymous" },
        { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Geist:wght@100..900&family=Geist+Mono:wght@100..900&family=Literata:ital,opsz,wght@0,7..72,200..900;1,7..72,200..900&display=swap" },
      ],
    },
  },
});
