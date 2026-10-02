<script setup lang="ts">
/** S1 "📉 Trend GPS (5 Tahun)" (FR-M08-16, FR-M08-17): Chart.js line chart + the yearly table. */
import { computed } from 'vue'

import { ChartCanvas } from '@/components/chart'
import { TABLE_CLASSES as T } from '@/components/data'

import type { SchoolPerformance } from '../../api/types'
import { BAND_STYLE, dec2, grouped } from '../../lib/prestasi/format'
import { gpsBands, trendData, trendOptions } from '../../lib/prestasi/gps-chart'

const props = defineProps<{ trend: SchoolPerformance['trend'] }>()

const data = computed(() => trendData(props.trend.chart))
const plugins = [gpsBands]
</script>

<template>
  <section class="min-w-0 rounded-2xl bg-white p-5 shadow" data-testid="trend-card">
    <div class="mb-1 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h3 class="text-base font-bold text-slate-700">📉 Trend GPS (5 Tahun)</h3>
      <span class="text-xs text-slate-400">2022–2026 · lebih rendah = lebih baik</span>
    </div>
    <p class="mb-3 text-xs text-slate-400">
      Paksi Y diterbalikkan: 0 (A+) di atas, 9 (G) di bawah.
    </p>
    <ChartCanvas
      type="line"
      :data="data"
      :options="trendOptions"
      :plugins="plugins"
      height="280px"
      test-id="gps-trend-chart"
    />
    <div class="mt-4 overflow-x-auto">
      <table :class="[T.table, 'min-w-[34rem]']" data-testid="trend-table">
        <thead>
          <tr>
            <th :class="T.th">Tahun</th>
            <th :class="[T.th, 'text-center']">GPS Keseluruhan</th>
            <th :class="[T.th, 'text-center']">Tahap</th>
            <th :class="[T.th, 'text-center']">Calon</th>
            <th :class="[T.th, 'text-center']">Sumber</th>
            <th :class="[T.th, 'text-center']">Perubahan</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="y in trend.years"
            :key="y.year"
            :class="T.row"
            :data-testid="`trend-row-${y.year}`"
          >
            <td :class="[T.td, 'font-bold whitespace-nowrap text-slate-800']">
              {{ y.year }}
              <span
                v-if="y.current"
                class="ml-1 rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-600"
                >Semasa</span
              >
            </td>
            <template v-if="y.current || y.gps === null">
              <td :class="[T.td, 'text-center text-slate-500']">Tiada data</td>
              <td :class="[T.td, 'text-center text-slate-400']">—</td>
              <td :class="[T.td, 'text-center text-slate-400']">—</td>
              <td :class="[T.td, 'text-center text-slate-400']">—</td>
              <td :class="[T.td, 'text-center text-slate-400']">—</td>
            </template>
            <template v-else>
              <td
                :class="[
                  T.td,
                  'text-center text-lg font-bold',
                  y.band ? BAND_STYLE[y.band].text : '',
                ]"
              >
                {{ dec2(y.gps) }}
              </td>
              <td :class="[T.td, 'text-center']">
                <span
                  v-if="y.band"
                  :class="[
                    'rounded-full border px-2 py-0.5 text-xs font-semibold',
                    BAND_STYLE[y.band].pill,
                  ]"
                  >{{ y.band }}</span
                >
              </td>
              <td :class="[T.td, 'text-center']">
                {{ y.candidates === null ? '—' : grouped(y.candidates) }}
              </td>
              <td :class="[T.td, 'text-center']">{{ y.source ?? '—' }}</td>
              <td :class="[T.td, 'text-center']">
                <span v-if="y.change === null || y.change === 0" class="text-slate-400">—</span>
                <span v-else-if="y.change < 0" class="text-emerald-600"
                  >▼ {{ dec2(Math.abs(y.change)) }}</span
                >
                <span v-else class="text-red-600">▲ {{ dec2(y.change) }}</span>
              </td>
            </template>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
