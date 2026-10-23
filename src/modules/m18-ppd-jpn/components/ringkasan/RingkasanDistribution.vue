<script setup lang="ts">
/**
 * S23 card "Taburan Risiko" (design 4.1 item 3): one horizontal bar chart over the three risk levels
 * (labels carry the server percent) plus the legend with icons. With no pupils the card shows the empty state.
 */
import { computed } from 'vue'

import { type DsTextTone, DsChart, DsCluster, DsEmptyState, DsPanel, DsStack, DsText } from '@/ds'
import { formatCount } from '@/lib/number'

import type { AmaranTally } from '../../api/amaran'
import { EMPTY_DISTRIBUTION } from './ringkasan-format'

const props = defineProps<{ tally: AmaranTally }>()

interface Segment {
  key: string
  label: string
  count: number
  pct: number
  icon: string
  tone: DsTextTone
}

const segments = computed<Segment[]>(() => [
  { key: 'green', label: 'Hijau', count: props.tally.green, pct: props.tally.pct.green, icon: 'i-ph-check-circle', tone: 'success' },
  { key: 'yellow', label: 'Kuning', count: props.tally.yellow, pct: props.tally.pct.yellow, icon: 'i-ph-warning', tone: 'warning' },
  { key: 'red', label: 'Merah', count: props.tally.red, pct: props.tally.pct.red, icon: 'i-ph-warning-octagon', tone: 'error' },
])
const labels = computed(() => segments.value.map((s) => `${s.label} (${String(s.pct)}%)`))
const series = computed(() => [{ label: 'Pelajar', data: segments.value.map((s) => s.count) }])
</script>

<template>
  <DsPanel title="Taburan Risiko" class="break-inside-avoid" data-testid="rk-distribution">
    <DsEmptyState
      v-if="tally.total === 0"
      size="sm"
      :title="EMPTY_DISTRIBUTION"
      data-testid="rk-empty"
    />
    <DsStack v-else gap="md">
      <DsChart
        type="bar"
        horizontal
        title="Pelajar mengikut tahap risiko"
        table-label="Pelajar mengikut tahap risiko"
        :labels="labels"
        :series="series"
        data-testid="rk-bar"
      />
      <DsCluster as="ul" gap="lg" row-gap="xs" data-testid="rk-legend">
        <DsText v-for="s in segments" :key="s.key" as="li" variant="body" :data-testid="`rk-legend-${s.key}`">
          <DsCluster as="span" gap="xs" :wrap="false">
            <DsText as="span" variant="body" :tone="s.tone">
              <UIcon :name="s.icon" class="size-5" aria-hidden="true" />
            </DsText>
            {{ s.label }}: {{ formatCount(s.count) }}
          </DsCluster>
        </DsText>
      </DsCluster>
    </DsStack>
  </DsPanel>
</template>
