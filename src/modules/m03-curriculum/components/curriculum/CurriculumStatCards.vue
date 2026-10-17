<script setup lang="ts">
/**
 * S1 summary cards (FR-M03-05): "Subjek" (blue), "Tahap" (purple), "Jumlah Bab" (emerald) and
 * "Topik / Subtopik" (amber). 2 across below `md`, 4 from `md`; long names wrap.
 */
import { DsStatTile } from '@/ds'

import type { CurriculumTree } from '../../api/admin-curriculum'

defineProps<{ tree: CurriculumTree }>()

</script>

<template>
  <div class="grid grid-cols-2 gap-4 md:grid-cols-4" data-testid="curriculum-stats">
    <DsStatTile
      :value="tree.subject.name"
      unit="Subjek"
      icon="i-ph-book"
      data-testid="stat-subject"
    />
    <DsStatTile
      :value="tree.level.name"
      unit="Tahap"
      icon="i-ph-graduation-cap"
      data-testid="stat-level"
    />
    <DsStatTile
      :value="tree.stats.chapters"
      unit="Jumlah Bab"
      icon="i-ph-book-open"
      data-testid="stat-chapters"
    />
    <DsStatTile
      :value="`${tree.stats.topics} / ${tree.stats.subtopics}`"
      unit="Topik / Subtopik"
      icon="i-ph-list"
      data-testid="stat-topics"
    />
  </div>
</template>
