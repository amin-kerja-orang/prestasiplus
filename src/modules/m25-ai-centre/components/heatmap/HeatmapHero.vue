<script setup lang="ts">
/** S1 hero and legend (FR-M25-13, 14): title, intro and four static pills (BR-M25-07). */
import { DsIconChip } from '@/ds'

import { HEATMAP_COPY, LEGEND } from './heatmap-copy'
</script>

<template>
  <section
    class="flex min-w-0 flex-col gap-4 rounded-card bg-default p-5 shadow-lift md:p-6"
    data-testid="heatmap-hero"
  >
    <div class="flex min-w-0 items-start gap-3">
      <DsIconChip icon="i-ph-fire-duotone" accent="heat" size="lg" />
      <div class="min-w-0">
        <h1 class="font-display text-title font-extrabold break-words text-highlighted">
          {{ HEATMAP_COPY.title }}
        </h1>
        <p class="mt-1 text-body text-muted">{{ HEATMAP_COPY.intro }}</p>
      </div>
    </div>
    <ul class="flex flex-wrap gap-2" data-testid="heatmap-legend">
      <li
        v-for="pill in LEGEND"
        :key="pill.key"
        class="inline-flex items-center gap-2 rounded-full bg-elevated px-3 py-1 text-label text-default"
        :data-legend="pill.key"
      >
        <span class="size-3 rounded-full" :class="pill.swatch" aria-hidden="true" />
        {{ pill.label }}
      </li>
    </ul>
  </section>
</template>
