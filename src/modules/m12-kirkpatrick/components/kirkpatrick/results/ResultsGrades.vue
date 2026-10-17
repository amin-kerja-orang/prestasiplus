<script setup lang="ts">
/**
 * "Taburan Gred ({tahun})" (FN-M12-6.2.1; FR-M12-49; BR-M12-17): a horizontal `DsChart` of the ten grades A+ ... G, bar
 * length = n, the label of each bar carries the grade and its % ("A+ · 12.3%"). Not rendered by the page when the
 * scope has no distribution.
 */
import { computed } from 'vue'

import { DsChart } from '@/ds'

import type { ResultsDistribution } from './results-types'
import { pct, plain } from '../common/kirkpatrick-format'

const props = defineProps<{ distribution: ResultsDistribution }>()

const labels = computed(() => props.distribution.rows.map((r) => `${r.grade} · ${pct(r.pct)}`))
const series = computed(() => [
  { label: 'Pelajar', data: props.distribution.rows.map((r) => r.n), slot: 1 },
])
</script>

<template>
  <UCard as="section" class="min-w-0" data-testid="res-grades">
    <div class="flex flex-col gap-3">
      <DsChart
        type="bar"
        horizontal
        :level="2"
        :title="`Taburan Gred (${distribution.year})`"
        :labels="labels"
        :series="series"
        table-label="Taburan gred calon"
      />
      <p class="text-caption text-muted">
        Berdasarkan {{ plain(distribution.candidates) }} calon — sumber: Headcount OTR
      </p>
    </div>
  </UCard>
</template>
