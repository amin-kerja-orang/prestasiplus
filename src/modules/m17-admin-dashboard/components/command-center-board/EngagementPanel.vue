<script setup lang="ts">
/**
 * "Engagement" (FR-M17-32, FN-M17-3.3.9). Platform view: the five horizontal bars Champion / Konsisten /
 * Berkembang / Minimum / Disengaged. School view (FR-M17-111, OQ-M17-12): the school's own answers of the
 * last 7 days as bars labelled by weekday. Both are a DS chart (no grid lines, a hidden data table).
 */
import { computed } from 'vue'

import { DsChart } from '@/ds'

import type { CcLiveData } from '../../api/command-center-board'
import { S2_COPY } from './board-copy'
import BoardPanel from './BoardPanel.vue'

const props = defineProps<{ data: CcLiveData | null; school: boolean }>()

const BANDS = [
  { key: 'champion', label: 'Juara' },
  { key: 'consistent', label: 'Konsisten' },
  { key: 'developing', label: 'Berkembang' },
  { key: 'minimum', label: 'Minimum' },
  { key: 'disengaged', label: 'Tidak Terlibat' },
] as const

const bandLabels = BANDS.map((b) => b.label)
const bandSeries = computed(() => [
  { label: 'Penglibatan', data: BANDS.map((b) => props.data?.engagement[b.key] ?? 0) },
])
const dayLabels = computed(() => (props.data?.dailyTrend ?? []).map((p) => p.label))
const daySeries = computed(() => [
  { label: 'Jawapan', data: (props.data?.dailyTrend ?? []).map((p) => p.count) },
])
</script>

<template>
  <BoardPanel icon="i-ph-users-three" title="Engagement" testid="cc-panel-engagement">
    <p v-if="!data" class="text-body text-muted">{{ S2_COPY.loading }}</p>
    <div v-else-if="!school" data-testid="cc-engagement-bands">
      <DsChart
        title="Engagement"
        :heading-level="3"
        horizontal
        :labels="bandLabels"
        :series="bandSeries"
        table-label="Penglibatan pelajar mengikut tahap"
      />
    </div>
    <div v-else data-testid="cc-engagement-days">
      <DsChart
        title="Jawapan 7 hari"
        :heading-level="3"
        :labels="dayLabels"
        :series="daySeries"
        table-label="Jawapan sekolah dalam 7 hari"
      />
    </div>
  </BoardPanel>
</template>
