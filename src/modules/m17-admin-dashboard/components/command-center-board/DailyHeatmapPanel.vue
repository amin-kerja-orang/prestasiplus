<script setup lang="ts">
/**
 * "Heatmap Jam (Hari Ini)" (FR-M17-44, FN-M17-4.4.2): 24 cells by MYT hour of `answeredAt`, tooltip
 * "{h}:00 — {n} soalan"; "Tiada data" when today has none. Rendered on the "Hari Ini" tab only.
 */
import { computed } from 'vue'

import { DsChart } from '@/ds'

import type { CcDailyActivity } from '../../api/command-center-board'
import { S3_COPY } from './board-copy'
import type { LoadStatus } from './composables'
import DailyPanel from './DailyPanel.vue'

const props = defineProps<{ data: CcDailyActivity | null; status: LoadStatus }>()

const counts = computed(() => {
  const heat = props.data?.hourlyHeatmap ?? {}
  return Array.from({ length: 24 }, (_, h) => heat[String(h)] ?? 0)
})
const any = computed(() => Math.max(...counts.value) > 0)
const labels = Array.from({ length: 24 }, (_, h) => `${String(h)}:00`)
const series = computed(() => [{ label: 'Soalan', data: counts.value }])
</script>

<template>
  <DailyPanel
    title="Heatmap Jam (Hari Ini)"
    icon="i-ph-clock"
    testid="cc-panel-heatmap"
    :state="status"
  >
    <p v-if="!any" class="text-center text-body text-muted" data-testid="cc-empty">
      {{ S3_COPY.noData }}
    </p>
    <div v-else data-testid="cc-heat-chart">
      <DsChart
        title="Soalan mengikut jam"
        :heading-level="3"
        :labels="labels"
        :series="series"
        table-label="Soalan dijawab mengikut jam (MYT)"
      />
    </div>
  </DailyPanel>
</template>
