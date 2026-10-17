<script setup lang="ts">
/** FN-M11-2.3.1: "Trend Aktiviti" card with the line chart (`DsChart`, no gridlines). */
import { computed } from 'vue'

import { DsChart } from '@/ds'

import type { TeacherReport } from '../../api/types'
import { LAPORAN_COPY, rangeAgo } from './copy'
import { trendChart } from './trend-chart'

const props = defineProps<{ trend: TeacherReport['trend']; range: number }>()
const chart = computed(() => trendChart(props.trend))
</script>

<template>
  <UCard class="min-w-0" data-testid="trend-card">
    <div class="flex flex-col gap-4">
      <p class="text-caption text-muted" data-testid="trend-range">{{ rangeAgo(range) }}</p>
      <DsChart
        type="line"
        :title="LAPORAN_COPY.trendTitle"
        :labels="chart.labels"
        :series="chart.series"
        unit=" aktiviti"
        :table-label="LAPORAN_COPY.trendTitle"
        data-testid="laporan-trend-chart"
      />
    </div>
  </UCard>
</template>
