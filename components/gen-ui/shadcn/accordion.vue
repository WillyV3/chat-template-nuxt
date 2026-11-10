<script setup lang="ts">
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

defineProps<{ items: { title: string; content: string }[]; type?: "single" | "multiple" | null }>();
</script>

<template>
  <Accordion v-if="type === 'multiple'" type="multiple" class="w-full">
    <AccordionItem v-for="(item, i) in items ?? []" :key="i" :value="`item-${i}`">
      <AccordionTrigger>{{ item.title }}</AccordionTrigger>
      <AccordionContent>{{ item.content }}</AccordionContent>
    </AccordionItem>
  </Accordion>
  <Accordion v-else type="single" collapsible class="w-full">
    <AccordionItem v-for="(item, i) in items ?? []" :key="i" :value="`item-${i}`">
      <AccordionTrigger>{{ item.title }}</AccordionTrigger>
      <AccordionContent>{{ item.content }}</AccordionContent>
    </AccordionItem>
  </Accordion>
</template>
