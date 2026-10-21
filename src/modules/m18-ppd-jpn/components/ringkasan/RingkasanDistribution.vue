<script setup lang="ts">
/**
 * S23 card "Taburan Risiko" (design 4.1 item 3): one horizontal bar chart over the three risk levels
 * (labels carry the server percent) plus the legend with icons. With no pupils the card shows the empty state.
 */
import { computed } from 'vue'

import { DsChart, DsEmptyState, DsPanel } from '@/ds'
import { formatCount } from '@/lib/number'

import type { AmaranTally } from '../../api/amaran'
import { EMPTY_DISTRIBUTION } from './ringkasan-format'

const props = defineProps<{ tally: AmaranTally }>()

const segments = computed(() => [
  { key: 'green', label: 'Hijau', count: props.tally.green, pct: props.tally.pct.green, icon: 'i-ph-check-circle', tone: 'text-success' },
  { key: 'yellow', label: 'Kuning', count: props.tally.yellow, pct: props.tally.pct.yellow, icon: 'i-ph-warning', tone: 'text-warning' },
  { key: 'red', label: 'Merah', count: props.tally.red, pct: props.tally.pct.red, icon: 'i-ph-warning-octagon', tone: 'text-error' },
])
const labels = computed(() => segments.value.map((s) => `${s.label} (${String(s.pct)}%)`))
const series = computed(() => [{ label: 'Pelajar', data: segments.value.map((s) => s.count) }])
</script>

<template>
  <DsPanel class="break-inside-avoid" data-testid="rk-distribution">
    <div class="flex flex-col gap-4">
      <h2 class="text-subheading text-highlighted">Taburan Risiko</h2>
      <DsEmptyState
        v-if="tally.total === 0"
        size="sm"
        :title="EMPTY_DISTRIBUTION"
        data-testid="rk-empty"
      />
      <template v-else>
        <DsChart
          type="bar"
          horizontal
          title="Pelajar mengikut tahap risiko"
          table-label="Pelajar mengikut tahap risiko"
          :labels="labels"
          :series="series"
          data-testid="rk-bar"
        />
        <ul class="flex flex-wrap gap-x-6 gap-y-2 text-body text-default" data-testid="rk-legend">
          <li
            v-for="s in segments"
            :key="s.key"
            class="inline-flex items-center gap-2"
            :data-testid="`rk-legend-${s.key}`"
          >
            <UIcon :name="s.icon" class="size-5" :class="s.tone" aria-hidden="true" />
            {{ s.label }}: {{ formatCount(s.count) }}
          </li>
        </ul>
      </template>
    </div>
  </DsPanel>
</template>
