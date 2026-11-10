// Server-render only: vitest runs in node here (no DOM), so this asserts on
// the static markup of each slot.

import { describe, expect, it } from "vitest"
import { createSSRApp, h } from "vue"
import { renderToString } from "vue/server-renderer"

import ChatShell from "./chat-shell.vue"

const span = (t: string) => () => h("span", t)

const render = (slots: Record<string, () => unknown>) =>
  renderToString(createSSRApp({ render: () => h(ChatShell, null, slots as never) }))

describe("ChatShell", () => {
  it("renders sidebar, main and right slots", async () => {
    const html = await render({
      sidebar: span("rail-slot"),
      mobileTitle: span("title-slot"),
      right: span("right-slot"),
      default: span("main-slot"),
    })
    for (const s of ["rail-slot", "title-slot", "main-slot", "right-slot", "Resize panel"]) {
      expect(html).toContain(s)
    }
  })

  it("header and rightHeader open their columns with the shared h-12 row", async () => {
    const html = await render({
      sidebar: span("rail-slot"),
      mobileTitle: span("title-slot"),
      header: span("stage-head"),
      right: span("right-slot"),
      rightHeader: span("right-head"),
      default: span("main-slot"),
    })
    expect(html.indexOf("stage-head")).toBeLessThan(html.indexOf("main-slot"))
    expect(html.indexOf("right-head")).toBeLessThan(html.indexOf("right-slot"))
    expect(html.match(/class="flex h-12 shrink-0/g)).toHaveLength(2)
    expect(html).not.toContain("title-slot")
  })

  it("renders no right panel when omitted", async () => {
    const html = await render({ sidebar: span("rail-slot"), mobileTitle: span("title-slot"), default: span("main-slot") })
    expect(html).toContain("main-slot")
    expect(html).not.toContain("Resize panel")
  })
})
