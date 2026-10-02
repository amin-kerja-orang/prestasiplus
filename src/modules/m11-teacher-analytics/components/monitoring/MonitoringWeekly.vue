<script setup lang="ts">
/**
 * S2 "Tracking Mingguan", `#section-mingguan` (FN-M11-3.6.1 / 3.6.2; FR-M11-43, 44). The Sekolah column
 * is sticky (as live; SRS FR-M11-43); the table scrolls inside its card. Cell classes come from the
 * handler (`cls`): zero slate, blue (first week or equal to the previous), green up, red down; the best
 * week gets an amber ring.
 */
import { CalendarRange, ArrowDown, ArrowUp, Minus } from '@lucide/vue'
import { RouterLink } from 'vue-router'

import type { WeeklyCellClass, WeeklyRow } from '../../api/types'
import { CARD, count } from './monitoring-format'
import type { MonitoringPaths } from './monitoring-paths'

defineProps<{
  weeks: readonly { k: number; from: string; to: string }[]
  rows: readonly WeeklyRow[]
  paths: MonitoringPaths
}>()

const CELL: Record<WeeklyCellClass, string> = {
  zero: 'bg-slate-50 text-slate-300',
  first: 'bg-blue-50 text-blue-700',
  up: 'bg-green-50 text-green-700',
  down: 'bg-red-50 text-red-600',
}
const TREND_TITLE = { up: 'Meningkat', down: 'Menurun', same: 'Sama' } as const
const TH = 'px-2 py-2 text-center text-xs font-bold text-slate-500'
</script>

<template>
  <section
    id="section-mingguan"
    :class="[CARD, 'scroll-mt-20 p-3 sm:p-5']"
    data-testid="mon-weekly"
  >
    <h3 class="flex items-center gap-2 font-heading text-base font-bold text-slate-800">
      <CalendarRange class="h-5 w-5 text-indigo-600" />Tracking Mingguan
    </h3>
    <p class="mb-3 text-xs text-slate-500">
      Jumlah soalan dijawab mengikut minggu — warna menunjukkan trend naik/turun
    </p>

    <div class="overflow-x-auto" data-testid="mon-weekly-scroller">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-slate-100">
            <th
              class="sticky left-0 z-10 bg-white px-2 py-2 text-left text-xs font-bold text-slate-500 uppercase"
            >
              Sekolah
            </th>
            <th
              v-for="w in weeks"
              :key="w.k"
              :class="TH"
              :title="`${w.from} - ${w.to}`"
              data-testid="mon-week-head"
            >
              M{{ w.k }}
            </th>
            <th :class="TH">Trend</th>
            <th :class="TH">Best</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="r in rows"
            :key="r.schoolId"
            class="border-b border-slate-50"
            data-testid="mon-weekly-row"
          >
            <td class="sticky left-0 z-10 bg-white px-2 py-1.5">
              <RouterLink
                :to="paths.school(r.schoolId)"
                :title="r.name"
                class="block max-w-[200px] truncate text-sm font-semibold text-slate-700 hover:text-indigo-600"
                >{{ r.name }}</RouterLink
              >
              <p class="text-xs text-slate-400">{{ r.code ?? '-' }}</p>
            </td>
            <td v-for="c in r.cells" :key="c.k" class="px-0.5 py-1">
              <div
                :class="[
                  'min-w-[44px] rounded px-1.5 py-1 text-center font-mono text-xs font-semibold',
                  CELL[c.cls],
                  c.best ? 'ring-2 ring-amber-400 ring-inset' : '',
                ]"
                :data-cls="c.cls"
                :data-best="c.best ? 'true' : 'false'"
                data-testid="mon-weekly-cell"
              >
                {{ c.count === 0 ? '-' : count(c.count) }}
              </div>
            </td>
            <td class="px-2 py-1.5 text-center text-lg" data-testid="mon-weekly-trend">
              <span
                :title="TREND_TITLE[r.trend]"
                class="inline-flex"
                data-testid="mon-weekly-trend-icon"
              >
                <ArrowUp v-if="r.trend === 'up'" class="h-5 w-5 text-green-500" />
                <ArrowDown v-else-if="r.trend === 'down'" class="h-5 w-5 text-red-500" />
                <Minus v-else class="h-5 w-5 text-slate-400" />
              </span>
            </td>
            <td class="px-2 py-1.5 text-center whitespace-nowrap" data-testid="mon-weekly-best">
              <template v-if="r.best">
                <span class="font-semibold text-amber-600">M{{ r.best.k }}</span>
                <span class="ml-1 text-xs text-slate-400">{{ count(r.best.count) }}</span>
              </template>
              <span v-else class="text-slate-300">-</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <p
      class="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500"
      data-testid="mon-week-footer"
    >
      <span v-for="w in weeks" :key="w.k"
        ><strong>M{{ w.k }}</strong
        >: {{ w.from }} - {{ w.to }}</span
      >
    </p>
  </section>
</template>
