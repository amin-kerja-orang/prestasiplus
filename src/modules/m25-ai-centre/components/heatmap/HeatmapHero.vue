<script setup lang="ts">
/** S1 hero and legend (FR-M25-13, 14): red gradient, white text, four static pills (BR-M25-07). */
import { HEATMAP_COPY, LEGEND } from './heatmap-copy'
</script>

<template>
  <section
    class="rounded-xl bg-linear-to-br from-red-700 to-red-600 p-5 text-white"
    data-testid="heatmap-hero"
  >
    <h1 class="text-[1.4rem] leading-tight font-bold text-white">{{ HEATMAP_COPY.title }}</h1>
    <p class="mt-1 text-sm text-white">{{ HEATMAP_COPY.intro }}</p>
    <ul class="mt-3 flex flex-wrap gap-2" data-testid="heatmap-legend">
      <li
        v-for="pill in LEGEND"
        :key="pill.key"
        :class="[
          'inline-block rounded-full border-2 bg-white px-3 py-[0.3rem] text-[0.8rem] leading-none font-bold',
          pill.cls,
        ]"
        :data-legend="pill.key"
      >
        {{ pill.label }}
      </li>
    </ul>
  </section>
</template>
