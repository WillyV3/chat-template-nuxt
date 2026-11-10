<script setup lang="ts">
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";

defineProps<{ items: { title?: string | null; description?: string | null }[] }>();
</script>

<template>
  <Carousel class="w-full">
    <CarouselContent>
      <CarouselItem v-for="(item, i) in items ?? []" :key="i" class="basis-3/4 md:basis-1/2 lg:basis-1/3">
        <div class="border border-border rounded-lg p-4 bg-card h-full">
          <h4 v-if="item.title" class="font-semibold text-sm mb-1">{{ item.title }}</h4>
          <p v-if="item.description" class="text-sm text-muted-foreground">{{ item.description }}</p>
        </div>
      </CarouselItem>
    </CarouselContent>
    <CarouselPrevious />
    <CarouselNext />
  </Carousel>
</template>
