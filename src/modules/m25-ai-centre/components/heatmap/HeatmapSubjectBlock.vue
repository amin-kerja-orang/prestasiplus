<script setup lang="ts">
/**
 * One subject block (FR-M25-15, 16, 17, 18): card, h2 with the subject name and a grid of cells
 * (`DsGrid` auto-fill with a 12rem = 192px minimum track, the closest DS token to the PRD's 200px: 1 column at 375).
 * Each cell is a plain link to its subject's Soalan by Chapter (`cellHref`), no `title`, no ARIA (D10). Fill is one A3
 * orange ramp (weak = strongest); the percentage is always printed.
 */
import { RouterLink } from 'vue-router'

import { DsGrid } from '@/ds'

import type { HeatmapSubject } from '../../api'

import { bandCellClass, cellHref, tileLine } from './heatmap-copy'

defineProps<{ subject: HeatmapSubject }>()
</script>

<template>
  <section class="rounded-card bg-default p-4 shadow-lift" data-testid="heatmap-subject">
    <h2 class="mb-3 text-heading text-highlighted">{{ subject.name }}</h2>
    <DsGrid min-item="sm" fit="fill" gap="sm" :equal-height="false" data-testid="heatmap-grid">
      <RouterLink
        v-for="topic in subject.chapters"
        :key="topic.id"
        :to="cellHref(subject)"
        class="block min-h-11 min-w-0 rounded-chip px-3 py-2.5 hover:opacity-80"
        :class="bandCellClass(topic.state)"
        :data-band="topic.state"
        :data-chapter-id="topic.id"
        data-testid="heatmap-cell"
      >
        <span class="block text-label break-words">{{ topic.name }}</span>
        <span class="mt-1 block text-caption">{{ tileLine(topic) }}</span>
      </RouterLink>
    </DsGrid>
  </section>
</template>
