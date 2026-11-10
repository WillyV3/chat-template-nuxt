<script setup lang="ts">
import { ref, watch } from "vue"
import { Loader2 } from "@lucide/vue"
import type { BundledLanguage } from "shiki"
import { getHighlighter } from "./file-viewer"
import PlainTextRenderer from "./plain-text-renderer.vue"

const props = defineProps<{ text: string; lang: BundledLanguage }>()

const html = ref("")
const err = ref<string | null>(null)

watch(
  () => [props.text, props.lang] as const,
  ([text, lang], _old, onCleanup) => {
    let cancel = false
    onCleanup(() => {
      cancel = true
    })
    getHighlighter()
      .then(async (hl) => {
        if (!hl.getLoadedLanguages().includes(lang)) {
          await hl.loadLanguage(lang as BundledLanguage)
        }
        if (cancel) return
        html.value = hl.codeToHtml(text, {
          lang,
          themes: {
            light: "github-light-default",
            dark: "github-dark-default",
          },
        })
      })
      .catch((e) => {
        if (cancel) return
        err.value = String(e)
      })
  },
  { immediate: true },
)
</script>

<template>
  <PlainTextRenderer v-if="err" :text="text" />
  <div v-else-if="!html" class="flex items-center gap-2 px-6 py-10 text-xs text-muted-foreground">
    <Loader2 class="size-3.5 animate-spin" /> Highlighting…
  </div>
  <!-- shiki output is escaped + tokenized HTML, safe to inject -->
  <div
    v-else
    class="px-6 py-6 text-sm [&_pre]:rounded-lg [&_pre]:!bg-muted [&_pre]:p-5 [&_pre]:overflow-x-auto [&_pre]:font-mono [&_pre]:leading-relaxed"
    v-html="html"
  />
</template>
