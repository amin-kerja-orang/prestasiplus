<script setup lang="ts">
/**
 * "Trend GPS ({a}–{b})" (FN-M12-6.4.1; FR-M12-51; BR-M12-20): Subjek · one column per year · Trend. The first row
 * "Keseluruhan" is highlighted. Values <= 4.00 are green-600, above amber-600; a missing value is "-" in
 * slate-300 (DV-M12-14); every Trend cell is the green up arrow as live. The table scrolls inside its card.
 */
import { computed } from 'vue'

import { DataTableCard, TABLE_CLASSES as T } from '@/components/data'
import { AppIcon } from '@/components/icon'

import { gps } from '../common/kirkpatrick-format'
import { gpsText } from './results-format'
import type { ResultsTrend } from './results-types'

const props = defineProps<{ trend: ResultsTrend }>()

const range = computed(() => {
  const years = props.trend.years
  return `${years[0] ?? ''}–${years[years.length - 1] ?? ''}`
})
/** The live trend table has plain (not upper-case) headers, so it does not use the shared `T.th`. */
const TH = 'px-4 py-3 text-xs font-bold whitespace-nowrap text-slate-500'
const HEAD = `${TH} text-center`
const HEAD_LEFT = TH
</script>

<template>
  <DataTableCard :min-width="560" data-testid="res-trend">
    <template #header>
      <h2
        class="flex items-center gap-2 px-4 pt-4 font-heading text-base font-bold text-slate-800 sm:px-5"
      >
        <AppIcon name="fa-chart-line" class="h-4 w-4 text-purple-600" />Trend GPS ({{ range }})
      </h2>
    </template>
    <table :class="T.table">
      <thead>
        <tr>
          <th :class="HEAD_LEFT">Subjek</th>
          <th v-for="y in trend.years" :key="y" :class="HEAD">{{ y }}</th>
          <th :class="HEAD">Trend</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(r, i) in trend.rows"
          :key="r.name"
          :class="[T.row, i === 0 ? 'bg-indigo-50/50 font-semibold' : '']"
          data-testid="res-trend-row"
        >
          <td :class="[T.td, i === 0 ? 'text-indigo-600' : '']">{{ r.name }}</td>
          <td
            v-for="(v, c) in r.values"
            :key="c"
            :class="[T.td, 'text-center', v === null ? 'text-slate-300' : gpsText(v)]"
            data-testid="res-trend-cell"
          >
            {{ v === null ? '-' : gps(v) }}
          </td>
          <td :class="`${T.td} text-center text-green-500`">
            <AppIcon name="fa-arrow-up" class="mx-auto h-4 w-4" />
          </td>
        </tr>
      </tbody>
    </table>
    <template #footer>
      <p class="flex items-center gap-1.5 px-4 pb-4 text-xs text-slate-400 sm:px-5">
        <AppIcon name="fa-arrow-up" class="h-3.5 w-3.5 shrink-0 text-green-500" />= GPS menurun
        (improving). Sumber: Headcount OTR &amp; SPM sebenar.
      </p>
    </template>
  </DataTableCard>
</template>
