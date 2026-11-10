<script setup lang="ts">
import { AlertTriangle } from "@lucide/vue"
import { Alert, AlertDescription } from "@/components/ui/alert"

defineProps<{ text: string }>()
</script>

<template>
  <div class="flex h-full flex-col gap-3 p-4 sm:p-6">
    <Alert>
      <AlertTriangle />
      <AlertDescription>
        Preview only — interactive elements are disabled for safety.
      </AlertDescription>
    </Alert>
    <iframe
      sandbox=""
      :srcdoc="text"
      title="HTML preview"
      class="h-full w-full flex-1 rounded-lg border bg-background"
    />
  </div>
</template>
