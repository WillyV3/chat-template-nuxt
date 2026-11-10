<script setup lang="ts">
// The input bar: the host's composer slot (mention list, target chips), the
// composer box (paperclip, voice controls, send/stop) and the voice status
// line. Presentational by design: every handler and every piece of state is
// passed in, so this file owns LAYOUT while use-chat-room owns behavior.
import type { Ref } from "vue";
import { Paperclip } from "@lucide/vue";

import Hint from "../ui/hint.vue";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import AttachMenu from "./attach-menu.vue";
import { composerPlaceholder } from "./composer";
import { RoomNodeView, type RoomNode } from "./room-node";
import type { VoiceState } from "./room-config";

const DEFAULT_HINT = "Attach a file — image, PDF, CSV, anything up to 50 MB. Choose where it saves.";

const props = withDefaults(
  defineProps<{
    textareaRef: Ref<HTMLTextAreaElement | null>;
    input: string;
    onInputChange: (value: string) => void;
    onKeyDown: (e: KeyboardEvent) => void;
    onPaste: (e: ClipboardEvent) => void;
    connected: boolean;
    /** composer.slot: anchored just above the input box (named composerSlot: `slot` is reserved in Vue). */
    composerSlot?: RoomNode;
    /** The paperclip. Absent = no attach button. `menu` = the room's own upload,
     *  which asks where the file saves; a host's attach.onFiles opens the plain
     *  picker. */
    attach?: { onPick: (dest: string) => void; menu: boolean; hint?: string };
    voiceState?: VoiceState;
    /** voice.controls: the host's mic and conversation-mode buttons. */
    voiceControls?: RoomNode;
    /** Attachments present: enables send with empty text. */
    hasAttachments: boolean;
    /** send.canSend / attach.canSend. */
    canSend?: boolean;
    /** A run is in flight (typing or streaming): show Stop instead of Send. */
    showStop: boolean;
    onSubmit: () => void;
    onAbort: () => void;
  }>(),
  { canSend: true },
);

const bindTextarea = (el: unknown) => {
  props.textareaRef.value =
    ((el as { $el?: HTMLTextAreaElement } | null)?.$el as HTMLTextAreaElement | undefined) ?? null;
};
</script>

<template>
  <!-- Input bar: no top border, one continuous surface with the conversation. -->
  <div class="w-full shrink-0 bg-background">
    <div class="mx-auto w-full max-w-3xl min-w-0 px-3 pt-1 pb-2 sm:px-4 sm:pt-1 sm:pb-3">
      <RoomNodeView :node="composerSlot" />
      <InputGroup
        class="rounded-2xl has-[[data-slot=input-group-control]:focus-visible]:ring-0 has-[[data-slot=input-group-control]:focus-visible]:border-border"
      >
        <InputGroupTextarea
          :ref="bindTextarea"
          :model-value="input"
          :placeholder="composerPlaceholder(voiceState ?? 'idle', connected)"
          aria-label="Message your agent"
          :disabled="!connected"
          :rows="1"
          @update:model-value="(v: string | number) => onInputChange(String(v))"
          @keydown="onKeyDown"
          @paste="onPaste"
        />
        <InputGroupAddon align="block-end">
          <template v-if="attach">
            <AttachMenu
              v-if="attach.menu"
              :on-pick="attach.onPick"
              :disabled="!connected"
              :hint="attach.hint ?? DEFAULT_HINT"
            />
            <Hint v-else :label="attach.hint ?? 'Attach a file'">
              <InputGroupButton
                size="icon-sm"
                :disabled="!connected"
                @click="attach.onPick('')"
              >
                <Paperclip />
              </InputGroupButton>
            </Hint>
          </template>

          <RoomNodeView :node="voiceControls" />

          <!-- Stop: square button, inverted monochrome, filled square glyph.
               No animation: stillness telegraphs "paused, waiting for input". -->
          <button
            v-if="showStop"
            type="button"
            aria-label="Stop generating"
            class="ml-auto flex size-8 items-center justify-center rounded-md bg-foreground text-background transition-opacity hover:opacity-90 active:opacity-80"
            @click="onAbort"
          >
            <span aria-hidden="true" class="block size-2.5 rounded-[2px] bg-background" />
          </button>
          <!-- Send: square button, inverted monochrome, custom paper-plane
               glyph drawn as a single path. Not a lucide icon, not a circle,
               not animated: deliberately quiet. canSend blocks a second send
               while something else is answering. Not folded into the stop
               branch above: that button aborts THIS agent's stream, and there
               is no stream to abort when the work is happening elsewhere. -->
          <button
            v-else
            type="button"
            :disabled="(!input.trim() && !hasAttachments) || !connected || !canSend"
            aria-label="Send message"
            class="ml-auto flex size-8 items-center justify-center rounded-md bg-foreground text-background transition-opacity hover:opacity-90 active:opacity-80 disabled:pointer-events-none disabled:opacity-25"
            @click="onSubmit"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              stroke-width="1.75"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M2.5 8 L13.5 2.5 L10 13.5 L7.5 9 Z" />
              <path d="M7.5 9 L2.5 8" />
            </svg>
          </button>
        </InputGroupAddon>
      </InputGroup>
    </div>

    <div
      v-if="(voiceState ?? 'idle') !== 'idle'"
      class="mx-auto flex max-w-3xl items-center justify-center gap-2 pb-2 text-xs text-muted-foreground"
    >
      <template v-if="voiceState === 'listening'">
        <span class="inline-block size-2 animate-pulse rounded-full bg-red-500" />
        Listening...
      </template>
      <template v-if="voiceState === 'processing'">Processing...</template>
      <template v-if="voiceState === 'speaking'">Speaking...</template>
    </div>
  </div>
</template>
