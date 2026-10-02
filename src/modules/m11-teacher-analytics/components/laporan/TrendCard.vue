<script setup lang="ts">
/** FN-M11-2.3.1: "Trend Aktiviti" card with the `h-64` Chart.js line chart. */
import { ChartLine } from '@lucide/vue'
import { computed } from 'vue'

import { ChartCanvas } from '@/components/chart'

import type { TeacherReport } from '../../api/types'
import { LAPORAN_COPY, rangeAgo } from './copy'
import { trendData, trendOptions } from './trend-chart'

const props = defineProps<{ trend: TeacherReport['trend']; range: number }>()
const data = computed(() => trendData(props.trend))
</script>

<template>
  <section class="min-w-0 rounded-2xl bg-white p-5 shadow" data-testid="trend-card">
    <div class="mb-3 flex items-center justify-between gap-3">
      <h3 class="flex items-center gap-2 text-base font-bold text-slate-800">
        <ChartLine class="h-4 w-4 text-indigo-500" />{{ LAPORAN_COPY.trendTitle }}
      </h3>
      <span class="text-xs text-slate-400" data-testid="trend-range">{{ rangeAgo(range) }}</span>
    </div>
    <ChartCanvas
      type="line"
      :data="data"
      :options="trendOptions"
      height="256px"
      test-id="laporan-trend-chart"
    />
  </section>
</template>
