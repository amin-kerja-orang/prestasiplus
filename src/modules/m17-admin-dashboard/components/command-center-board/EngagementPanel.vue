<script setup lang="ts">
/**
 * "Engagement" (FR-M17-32, FN-M17-3.3.9). Platform view: the five horizontal bars Champion / Konsisten /
 * Berkembang / Minimum / Disengaged. School view (FR-M17-111, OQ-M17-12): the school's own answers of the
 * last 7 days as bars labelled by weekday. Both are a DS chart (no grid lines, a hidden data table).
 */
import { computed } from 'vue'

import { DsChart, DsSurface } from '@/ds'
import { formatCount } from '@/lib/number'

import type { CcLiveData } from '../../api/command-center-board'
import { S2_COPY } from './board-copy'
import BoardPanel from './BoardPanel.vue'

const props = defineProps<{ data: CcLiveData | null; school: boolean }>()

const BANDS = [
  { key: 'champion', label: 'Champion' },
  { key: 'consistent', label: 'Konsisten' },
  { key: 'developing', label: 'Berkembang' },
  { key: 'minimum', label: 'Minimum' },
  { key: 'disengaged', label: 'Disengaged' },
] as const

const BAND_COLUMNS = [
  { accessorKey: 'label', header: 'Tahap' },
  { accessorKey: 'count', header: 'Engagement' },
]

const bandTiles = computed(() => {
  const counts = BANDS.map((b) => props.data?.engagement[b.key] ?? 0)
  const max = Math.max(1, ...counts)
  return BANDS.map((b, i) => ({
    key: b.key,
    label: b.label,
    count: formatCount(counts[i] ?? 0),
    width: ((counts[i] ?? 0) / max) * 100,
  }))
})
const dayLabels = computed(() => (props.data?.dailyTrend ?? []).map((p) => p.label))
const daySeries = computed(() => [
  { label: 'Jawapan', data: (props.data?.dailyTrend ?? []).map((p) => p.count) },
])
</script>

<template>
  <BoardPanel icon="i-ph-users-three" title="Engagement" testid="cc-panel-engagement">
    <p v-if="!data" class="text-body text-muted">{{ S2_COPY.loading }}</p>
    <div v-else-if="!school" class="flex flex-col gap-3" data-testid="cc-engagement-bands">
      <h3 class="sr-only">Engagement</h3>
      <UTable
        class="sr-only"
        :data="bandTiles"
        :columns="BAND_COLUMNS"
        caption="Engagement pelajar mengikut tahap"
      />
      <ul class="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <DsSurface
          v-for="b in bandTiles"
          :key="b.key"
          as="li"
          level="soft"
          radius="chip"
          padding="md"
          class="flex min-w-0 flex-col gap-2"
          :data-testid="`cc-engagement-${b.key}`"
        >
          <span class="truncate text-body text-muted">{{ b.label }}</span>
          <span class="tabular text-heading text-highlighted">{{ b.count }}</span>
          <UProgress :model-value="b.width" :max="100" aria-hidden="true" />
        </DsSurface>
      </ul>
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
