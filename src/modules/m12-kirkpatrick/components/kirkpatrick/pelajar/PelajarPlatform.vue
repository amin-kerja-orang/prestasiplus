<script setup lang="ts">
/**
 * "Tahap 2 — Prestasi Platform" (FN-M12-9.4.1; FR-M12-83; BR-M12-28): one row per practised subject by accuracy descending,
 * "{x}% ({n})" with a progress bar of value x (success >= 70, warning 50 to < 70, error below).
 */
import { computed } from 'vue'

import type { StudentKirkpatrick } from '../../../api/types'
import KirkpatrickPanel from '../common/KirkpatrickPanel.vue'
import { pct1 } from '../common/kirkpatrick-format'
import { barColor } from './pelajar-format'

const props = defineProps<{ platform: StudentKirkpatrick['platform'] }>()

const rows = computed(() => [...props.platform].sort((a, b) => b.accuracy - a.accuracy))
</script>

<template>
  <KirkpatrickPanel
    title="Tahap 2 — Prestasi Platform"
    icon="i-ph-chart-bar"
    data-testid="pel-platform"
  >
    <ul class="flex flex-col gap-3">
      <li v-for="r in rows" :key="r.subjectName" data-testid="pel-plat-row">
        <div class="flex items-baseline justify-between gap-3">
          <span class="min-w-0 text-label text-muted">{{ r.subjectName }}</span>
          <span class="tabular shrink-0 text-caption text-highlighted" data-testid="pel-plat-value"
            >{{ pct1(r.accuracy) }} ({{ r.answers }})</span
          >
        </div>
        <UProgress
          :model-value="r.accuracy"
          :max="100"
          :color="barColor(r.accuracy)"
          size="sm"
          class="mt-1"
          :aria-label="`${r.subjectName} ${pct1(r.accuracy)}`"
          data-testid="pel-plat-bar"
        />
      </li>
    </ul>
  </KirkpatrickPanel>
</template>
