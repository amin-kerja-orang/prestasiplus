<script setup lang="ts">
/**
 * S1 summary tiles (FR-M03-05): "Subjek", "Tahap", "Jumlah Bab" and "Topik / Subtopik" as compact
 * KPI tiles (`DsStatRow`) with coloured icon chips. Long names are truncated by the tile.
 */
import { computed } from 'vue'

import { DsStatRow, type StatItem } from '@/ds'

import type { CurriculumTree } from '../../api/admin-curriculum'

const props = defineProps<{ tree: CurriculumTree }>()

const items = computed<StatItem[]>(() => [
  { key: 'subject', label: 'Subjek', value: props.tree.subject.name, icon: 'book' },
  {
    key: 'level',
    label: 'Tahap',
    value: props.tree.level.name,
    icon: 'graduation-cap',
    accent: 'friend',
  },
  {
    key: 'chapters',
    label: 'Jumlah Bab',
    value: props.tree.stats.chapters,
    icon: 'book-open',
    accent: 'win',
  },
  {
    key: 'topics',
    label: 'Topik / Subtopik',
    value: `${String(props.tree.stats.topics)} / ${String(props.tree.stats.subtopics)}`,
    icon: 'list',
    accent: 'trial',
  },
])
</script>

<template>
  <DsStatRow
    prefix="stat"
    :items="items"
    compact
    :cols="4"
    aria-label="Ringkasan kurikulum"
    data-testid="curriculum-stats"
  />
</template>
