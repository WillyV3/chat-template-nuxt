<script setup lang="ts">
import { onMounted, provide, ref, type HTMLAttributes, type Ref } from "vue"
import { cn } from "@/lib/utils"
import {
  useStickToBottom,
  type Animation,
  type GetTargetScrollTop,
} from "../hooks/use-stick-to-bottom"
import { StickToBottomKey, type StickToBottomContext } from "./conversation"

const props = withDefaults(
  defineProps<{
    class?: HTMLAttributes["class"]
    /** Receives the stick-to-bottom context (scrollToBottom, isAtBottom, ...). */
    contextRef?: Ref<StickToBottomContext | null>
    resize?: Animation
    initial?: Animation | boolean
    mass?: number
    damping?: number
    stiffness?: number
    targetScrollTop?: GetTargetScrollTop
  }>(),
  { initial: "smooth", resize: "smooth" },
)

// A child may install its own targetScrollTop on the context; it wins over the prop.
const instance = useStickToBottom(() => ({
  mass: props.mass,
  damping: props.damping,
  stiffness: props.stiffness,
  resize: props.resize,
  initial: props.initial,
  targetScrollTop: (target, elements) =>
    (context.targetScrollTop ?? props.targetScrollTop)?.(target, elements) ?? target,
}))

const context: StickToBottomContext = {
  scrollToBottom: instance.scrollToBottom,
  stopScroll: instance.stopScroll,
  scrollRef: instance.scrollRef,
  contentRef: instance.contentRef,
  setScrollEl: instance.setScrollEl,
  setContentEl: instance.setContentEl,
  isAtBottom: instance.isAtBottom,
  escapedFromLock: instance.escapedFromLock,
  state: instance.state,
  targetScrollTop: null,
}
provide(StickToBottomKey, context)
if (props.contextRef) props.contextRef.value = context

const root = ref<HTMLElement | null>(null)
onMounted(() => {
  const scroll = instance.scrollRef.current
  if (scroll && getComputedStyle(scroll).overflow === "visible") {
    scroll.style.overflow = "auto"
  }
})
</script>

<template>
  <div
    ref="root"
    role="log"
    :class="cn('relative flex-1 overflow-y-auto', props.class)"
  >
    <slot :context="context" />
  </div>
</template>
