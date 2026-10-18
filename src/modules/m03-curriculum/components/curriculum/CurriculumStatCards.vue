<script setup lang="ts">
/**
 * S1 summary tiles (FR-M03-05): "Subjek", "Tahap", "Jumlah Bab" and "Topik / Subtopik" as compact
 * KPI tiles with coloured icon chips. Long names are truncated by the tile (full text in the title).
 */
import { AdminKpiStrip } from '@/ds/admin'
import { DsStatTile } from '@/ds'

import type { CurriculumTree } from '../../api/admin-curriculum'

defineProps<{ tree: CurriculumTree }>()
</script>

<template>
  <AdminKpiStrip
    label="Ringkasan kurikulum"
    class="xl:grid-cols-4 2xl:grid-cols-4"
    data-testid="curriculum-stats"
  >
    <DsStatTile
      compact
      :value="tree.subject.name"
      unit="Subjek"
      icon="i-ph-book"
      data-testid="stat-subject"
    />
    <DsStatTile
      compact
      accent="friend"
      :value="tree.level.name"
      unit="Tahap"
      icon="i-ph-graduation-cap"
      data-testid="stat-level"
    />
    <DsStatTile
      compact
      accent="win"
      :value="tree.stats.chapters"
      unit="Jumlah Bab"
      icon="i-ph-book-open"
      data-testid="stat-chapters"
    />
    <DsStatTile
      compact
      accent="trial"
      :value="`${tree.stats.topics} / ${tree.stats.subtopics}`"
      unit="Topik / Subtopik"
      icon="i-ph-list"
      data-testid="stat-topics"
    />
  </AdminKpiStrip>
</template>
