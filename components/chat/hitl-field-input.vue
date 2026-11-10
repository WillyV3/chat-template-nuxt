<script setup lang="ts">
import { ChevronRight } from "@lucide/vue";

import type { HitlField } from "@/components/chat/hitl-cards";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

defineProps<{
  field: HitlField;
  value: string;
  onChange: (val: string) => void;
}>();
</script>

<template>
  <Field v-if="(field.type ?? 'text') === 'readonly'">
    <FieldLabel class="text-xs text-muted-foreground">{{ field.label }}</FieldLabel>
    <div class="rounded-md bg-muted/50 px-3 py-2 font-mono text-xs">
      {{ field.value ?? value }}
    </div>
  </Field>

  <Field v-else-if="field.type === 'code'">
    <FieldLabel class="text-xs text-muted-foreground">{{ field.label }}</FieldLabel>
    <pre class="max-h-24 overflow-auto rounded-md bg-muted/50 px-3 py-2 font-mono text-xs">{{ field.value ?? value }}</pre>
  </Field>

  <!-- Collapsible rather than raw <details>: the arrows were literal text
       characters faked with group-open:hidden, which don't rotate, don't
       inherit icon sizing, and read as glyphs to a screen reader. reka-ui
       supplies real disclosure semantics (aria-expanded, aria-controls). -->
  <Collapsible v-else-if="field.type === 'details'" class="group">
    <CollapsibleTrigger
      class="flex cursor-pointer select-none items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
    >
      <ChevronRight class="size-3 transition-transform group-data-[state=open]:rotate-90" aria-hidden="true" />
      <span class="group-data-[state=open]:hidden">Show details</span>
      <span class="hidden group-data-[state=open]:inline">Hide details</span>
    </CollapsibleTrigger>
    <CollapsibleContent>
      <pre class="mt-1 max-h-24 overflow-auto rounded-md bg-muted/50 px-3 py-2 font-mono text-xs">{{ field.value ?? value }}</pre>
    </CollapsibleContent>
  </Collapsible>

  <Field v-else-if="field.type === 'textarea'">
    <FieldLabel :for="field.key" class="text-xs">{{ field.label }}</FieldLabel>
    <Textarea
      :id="field.key"
      :placeholder="field.placeholder"
      :model-value="value"
      class="h-20 font-mono text-xs"
      @update:model-value="(v) => onChange(String(v))"
    />
  </Field>

  <Field v-else>
    <FieldLabel :for="field.key" class="text-xs">{{ field.label }}</FieldLabel>
    <Input
      :id="field.key"
      :type="field.type === 'password' ? 'password' : 'text'"
      :placeholder="field.placeholder"
      :model-value="value"
      class="h-8 font-mono text-xs"
      @update:model-value="(v) => onChange(String(v))"
    />
  </Field>
</template>
