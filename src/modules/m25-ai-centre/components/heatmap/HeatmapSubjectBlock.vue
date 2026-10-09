<script setup lang="ts">
/**
 * One subject block (FR-M25-15, 16, 17, 18): white card, h2 with the subject name and a grid of cells
 * (`repeat(auto-fill, minmax(200px, 1fr))`, gap 0.5 rem: 1 / 3 / 4 columns at 375 / 768 / 1280). Each cell is a
 * plain link to `/practice/chapter` with no `title` and no ARIA (D10, DV-M25-02).
 */
import { RouterLink } from 'vue-router'

import type { HeatmapSubject } from '../../api'

import { BAND_CELL_CLASS, CELL_HREF, figuresLine } from './heatmap-copy'

defineProps<{ subject: HeatmapSubject }>()
</script>

<template>
  <section
    class="rounded-[10px] border border-slate-200 bg-white p-4"
    data-testid="heatmap-subject"
  >
    <h2 class="mb-3 text-[1.1rem] font-bold text-blue-900">{{ subject.name }}</h2>
    <div
      class="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2"
      data-testid="heatmap-grid"
    >
      <RouterLink
        v-for="topic in subject.topics"
        :key="topic.chapterId"
        :to="CELL_HREF"
        :class="[
          'block min-h-11 min-w-0 cursor-pointer rounded-lg border px-3 py-[0.6rem] text-gray-800 transition-[transform,box-shadow] duration-100 [&:hover]:[transform:translateY(-2px)] [&:hover]:shadow-[0_4px_8px_rgba(0,0,0,0.1)]',
          BAND_CELL_CLASS[topic.band],
        ]"
        :data-band="topic.band"
        :data-chapter-id="topic.chapterId"
        data-testid="heatmap-cell"
      >
        <span class="block text-[0.85rem] leading-[1.3] font-semibold break-words">{{
          topic.name
        }}</span>
        <span class="mt-[0.2rem] block text-xs text-slate-600">{{
          figuresLine(topic.attempts, topic.percent)
        }}</span>
      </RouterLink>
    </div>
  </section>
</template>
