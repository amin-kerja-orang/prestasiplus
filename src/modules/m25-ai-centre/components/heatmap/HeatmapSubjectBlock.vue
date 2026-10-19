<script setup lang="ts">
/**
 * One subject block (FR-M25-15, 16, 17, 18): card, h2 with the subject name and a grid of cells
 * (`repeat(auto-fill, minmax(200px, 1fr))`: 1 / 3 / 4 columns at 375 / 768 / 1280). Each cell is a
 * plain link to `/practice/chapter` with no `title` and no ARIA (D10, DV-M25-02). Fill is one A3
 * orange ramp (weak = strongest); the percentage is always printed.
 */
import { RouterLink } from 'vue-router'

import type { HeatmapSubject } from '../../api'

import { bandCellClass, CELL_HREF, figuresLine } from './heatmap-copy'
import { DsSurface, DsGrid, DsText } from '@/ds'

defineProps<{ subject: HeatmapSubject }>()
</script>

<template>
  <DsSurface as="section" radius="card" shadow="lift" :clip="false" data-testid="heatmap-subject">
    <h2 class="mb-3 text-heading text-highlighted">{{ subject.name }}</h2>
    <DsGrid :cols="{ base: 1, md: 3, xl: 4 }" gap="xs" data-testid="heatmap-grid">
      <RouterLink
        v-for="topic in subject.topics"
        :key="topic.chapterId"
        :to="CELL_HREF"
        class="block min-h-11 min-w-0 rounded-chip px-3 py-2.5 hover:opacity-80"
        :class="bandCellClass(topic.band)"
        :data-band="topic.band"
        :data-chapter-id="topic.chapterId"
        data-testid="heatmap-cell"
      >
        <DsText variant="label" wrap="anywhere" class="block">{{ topic.name }}</DsText>
        <span class="mt-1 block text-caption">{{
          figuresLine(topic.attempts, topic.percent)
        }}</span>
      </RouterLink>
    </DsGrid>
  </DsSurface>
</template>
