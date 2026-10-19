<script setup lang="ts">
/**
 * S4 card "Taburan Risiko Seluruh Sekolah" (restyle spec AS-49): a `DsChart` of the pupils per risk level
 * (Hijau, Kuning, Merah, with the integer percent in the label) and the legend with the three counts,
 * each with its icon so colour never stands alone.
 */
import { computed } from 'vue'

import { DsChart, DsPanel, DsStack, DsHeading } from '@/ds'
import { formatCount } from '@/lib/number'

import type { RiskTallyView } from '../../api/amaran'

const props = defineProps<{ tally: RiskTallyView }>()

const segments = computed(() => [
  {
    key: 'green',
    label: 'Hijau',
    count: props.tally.green,
    pct: props.tally.pct.green,
    icon: 'i-ph-check-circle',
  },
  {
    key: 'yellow',
    label: 'Kuning',
    count: props.tally.yellow,
    pct: props.tally.pct.yellow,
    icon: 'i-ph-warning',
  },
  {
    key: 'red',
    label: 'Merah',
    count: props.tally.red,
    pct: props.tally.pct.red,
    icon: 'i-ph-warning-octagon',
  },
])
const labels = computed(() => segments.value.map((s) => `${s.label} (${String(s.pct)}%)`))
const series = computed(() => [{ label: 'Pelajar', data: segments.value.map((s) => s.count) }])
</script>

<template>
  <DsPanel data-testid="am-distribution">
    <DsStack>
      <DsHeading :level="2" variant="subheading">Taburan Risiko Seluruh Sekolah</DsHeading>
      <DsChart
        type="bar"
        horizontal
        title="Pelajar mengikut tahap risiko"
        table-label="Pelajar mengikut tahap risiko"
        :labels="labels"
        :series="series"
        data-testid="am-bar"
      />
      <ul class="flex flex-wrap gap-x-6 gap-y-2 text-body text-default" data-testid="am-legend">
        <li
          v-for="s in segments"
          :key="s.key"
          class="inline-flex items-center gap-2"
          :data-testid="`am-legend-${s.key}`"
        >
          <UIcon
            :name="s.icon"
            class="size-5"
            :class="
              s.key === 'green'
                ? 'text-success'
                : s.key === 'yellow'
                  ? 'text-warning'
                  : 'text-error'
            "
            aria-hidden="true"
          />
          {{ s.label }}: {{ formatCount(s.count) }}
        </li>
      </ul>
    </DsStack>
  </DsPanel>
</template>
