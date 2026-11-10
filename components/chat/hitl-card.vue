<script setup lang="ts">
// Generic HITL Card.
import { computed, onBeforeUnmount, reactive, ref, watch } from "vue";
import { Clock, Loader2 } from "@lucide/vue";

import AgentOrb from "@/components/chat/agent-orb.vue";
import HitlFieldInput from "@/components/chat/hitl-field-input.vue";
import { ACCENT_STYLES, resolveIcon, type HitlRequest } from "@/components/chat/hitl-cards";
import { WAITING_ORB } from "@/components/chat/lib/orb-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const props = defineProps<{
  request: HitlRequest;
  onAction: (id: string, action: string, values: Record<string, string>) => void;
}>();

const values = reactive<Record<string, string>>(
  Object.fromEntries((props.request.fields ?? []).map((f) => [f.key, f.value ?? ""])),
);
const loading = ref(false);
const remaining = ref(0);

// Countdown timer
let interval: ReturnType<typeof setInterval> | undefined;
watch(
  () => props.request.expiresAtMs,
  (expiresAtMs) => {
    clearInterval(interval);
    interval = undefined;
    if (!expiresAtMs) return;
    const tick = () => {
      const left = Math.max(0, expiresAtMs - Date.now());
      remaining.value = Math.ceil(left / 1000);
    };
    tick();
    interval = setInterval(tick, 1000);
  },
  { immediate: true },
);
onBeforeUnmount(() => clearInterval(interval));

const accent = computed(() => ACCENT_STYLES[props.request.accent ?? "primary"]);
const icon = computed(() => resolveIcon(props.request.icon));

const allFilled = computed(
  () =>
    props.request.variant === "confirm" ||
    (props.request.fields ?? [])
      .filter((f) => f.required !== false)
      .every((f) => (values[f.key] ?? "").trim().length > 0),
);

function handleAction(actionKey: string) {
  loading.value = true;
  props.onAction(props.request.id, actionKey, { ...values });
}
</script>

<template>
  <!-- Deliberately NOT shadcn <Card>. Card is `flex flex-col gap-6 py-6`, so the
       old markup fought it: p-4 on the children overrode the padding but not the
       24px py or the 24px gap, which is where the dead vertical bands above and
       below the question came from. A plain container spends exactly the space
       it means to.

       Layout grammar follows 21st.dev's Agent Elements (its plan/tool approval
       cards): compact bordered container, one accent rail, tight low-profile
       actions. Its OWN tokens (--an-tool-background, --an-primary-color) are not
       imported: those would be a second design system sitting next to ours. -->
  <div
    :class="
      cn(
        'overflow-hidden rounded-lg border border-l-2 bg-card text-card-foreground shadow-sm',
        accent.rail,
      )
    "
  >
    <div class="flex flex-col gap-2.5 p-3">
      <div class="flex items-start gap-2">
        <!-- The agent is STOPPED here, waiting on the person reading this.
             "breathing" is the only orb that reads as alive-but-not-working;
             a spinning one would imply progress that is not happening.
             Same vocabulary as the transcript, see lib/orb-state.ts. -->
        <AgentOrb :state="WAITING_ORB" :size="20" class="mt-px shrink-0" />

        <!-- The question owns the full remaining width. It used to share a
             justify-between row with the badges, which have no shrink
             pressure, so at 390px "Your agent wants to run peer_status_set"
             wrapped onto three lines while the badges sat comfortably beside
             it. The badges moved BELOW, where wrapping is free. -->
        <div class="min-w-0 flex-1 space-y-1.5">
          <p class="text-sm font-medium leading-snug">{{ request.title }}</p>
          <p v-if="request.description" class="text-xs leading-snug text-muted-foreground">
            {{ request.description }}
          </p>
          <div class="flex flex-wrap items-center gap-1.5">
            <Badge
              v-if="request.tool"
              variant="secondary"
              :class="cn('h-5 gap-1 px-1.5 font-mono text-[10px] font-normal', accent.badge)"
            >
              <!-- The descriptor icon lives IN the badge now. Beside the orb
                   it was a second glyph competing with an animated one for
                   the same 20px of a phone's width. -->
              <component :is="icon" v-if="icon" class="size-3" />
              {{ request.tool }}
            </Badge>
            <Badge
              v-if="request.expiresAtMs && remaining > 0"
              variant="outline"
              class="h-5 gap-1 px-1.5 font-mono text-[10px] font-normal tabular-nums"
            >
              <Clock class="size-3" />
              {{ remaining }}s
            </Badge>
          </div>
        </div>
      </div>

      <div v-if="request.fields && request.fields.length > 0" class="space-y-2">
        <HitlFieldInput
          v-for="field in request.fields"
          :key="field.key"
          :field="field"
          :value="values[field.key] ?? ''"
          :on-change="(val: string) => (values[field.key] = val)"
        />
      </div>

      <!-- Wraps rather than overflowing: three actions at 390px is already
           tight, and a localised label makes it tighter. -->
      <div class="flex flex-wrap items-center gap-1.5">
        <Button
          v-for="action in request.actions"
          :key="action.key"
          size="sm"
          :variant="action.variant ?? 'default'"
          class="h-7 px-2.5 text-xs"
          :disabled="loading || (action.key !== 'cancel' && !allFilled)"
          @click="handleAction(action.key)"
        >
          <Loader2
            v-if="loading && action.variant !== 'ghost' && action.variant !== 'destructive'"
            class="mr-1 size-3 animate-spin"
          />
          {{ action.label }}
        </Button>
      </div>
    </div>
  </div>
</template>
