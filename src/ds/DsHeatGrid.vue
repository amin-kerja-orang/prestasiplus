<script setup lang="ts">
/**
 * Heat grid: CSS-grid colour-scale cells, a 5-step single-hue ramp starting at `bg-elevated`
 * (staff ends in kobalt, learner in the A3 orange). Every cell prints its percentage, is
 * keyboard-focusable and opens a popover with the details. A legend explains the ramp. Below
 * `md` it falls back to a list of cards (one per row).
 */
import { computed } from 'vue'

import { dsCopy } from './copy'
import { usePersonality } from './personality'
import { useMedia } from './useMedia'

export interface HeatRow {
  id: string
  label: string
  /** One value (0-100, or null for no data) per column. */
  cells: (number | null)[]
}

const props = withDefaults(
  defineProps<{
    columns: string[]
    rows: HeatRow[]
    /** Accessible name of the grid (BM). */
    label: string
    lowLabel?: string
    highLabel?: string
    unit?: string
    /** Text of the empty cell (BM). */
    noDataLabel?: string
    /** Skeleton in place of the grid. */
    loading?: boolean
    /** Show the low-to-high colour legend; false when the page renders its own legend. */
    legend?: boolean
  }>(),
  { lowLabel: dsCopy.heatLow, highLabel: dsCopy.heatHigh, unit: '%', noDataLabel: dsCopy.heatNoData, loading: false, legend: true },
)

const personality = usePersonality()
const wide = useMedia('(min-width: 768px)')

const STAFF = ['bg-elevated', 'bg-primary/15', 'bg-primary/35', 'bg-primary/60', 'bg-primary']
const LEARNER = ['bg-elevated', 'bg-heat/15', 'bg-heat/35', 'bg-heat/60', 'bg-heat']
const STAFF_TEXT = ['text-highlighted', 'text-highlighted', 'text-highlighted', 'text-highlighted', 'text-primary-on']
const LEARNER_TEXT = ['text-highlighted', 'text-highlighted', 'text-highlighted', 'text-highlighted', 'text-on-sem']

const ramp = computed(() => (personality.value === 'learner' ? LEARNER : STAFF))
const rampText = computed(() => (personality.value === 'learner' ? LEARNER_TEXT : STAFF_TEXT))

/** Row label + N columns (literal classes so the class linter can read them). */
const GRID_COLS = [
  'grid-cols-2',
  'grid-cols-3',
  'grid-cols-4',
  'grid-cols-5',
  'grid-cols-6',
  'grid-cols-7',
  'grid-cols-8',
  'grid-cols-9',
  'grid-cols-10',
  'grid-cols-11',
  'grid-cols-12',
]
const gridCols = computed(
  () => GRID_COLS[Math.min(Math.max(props.columns.length, 1), GRID_COLS.length) - 1] ?? 'grid-cols-2',
)

function step(v: number | null): number {
  if (v === null) return 0
  return Math.min(4, Math.max(0, Math.floor(v / 20)))
}
function bg(v: number | null): string {
  return ramp.value[step(v)] ?? 'bg-elevated'
}
function fg(v: number | null): string {
  return rampText.value[step(v)] ?? 'text-highlighted'
}
function text(v: number | null): string {
  return v === null ? '-' : `${Math.round(v)}${props.unit}`
}
function detail(row: HeatRow, c: number): string {
  const v = row.cells[c] ?? null
  return `${row.label} - ${props.columns[c] ?? ''}: ${v === null ? props.noDataLabel : text(v)}`
}
</script>

<template>
  <div
    class="flex min-w-0 flex-col gap-3"
    :aria-busy="loading ? 'true' : undefined"
    data-ds="heat-grid"
  >
    <USkeleton v-if="loading" class="h-40 w-full" data-ds="heat-loading" />
    <div v-else-if="wide" class="max-w-full overflow-x-auto" role="group" :aria-label="label">
      <div class="grid min-w-max gap-1" :class="gridCols">
        <span aria-hidden="true" />
        <span
          v-for="(c, i) in columns"
          :key="i"
          class="truncate px-2 text-center text-overline text-muted"
        >
          {{ c }}
        </span>
        <div v-for="row in rows" :key="row.id" class="contents">
          <span class="flex min-h-11 items-center truncate pe-2 text-label text-highlighted">
            {{ row.label }}
          </span>
          <UPopover v-for="(_, c) in columns" :key="c">
            <UButton
              type="button"
              color="neutral"
              variant="ghost"
              class="tabular min-h-11 justify-center rounded-chip text-label font-bold"
              :class="[bg(row.cells[c] ?? null), fg(row.cells[c] ?? null)]"
              :label="text(row.cells[c] ?? null)"
              :aria-label="detail(row, c)"
              data-ds="heat-cell"
            />
            <template #content>
              <p class="p-3 text-caption text-default" data-ds="heat-popover">
                <slot name="popover" :row="row" :column="c" :value="row.cells[c] ?? null">
                  {{ detail(row, c) }}
                </slot>
              </p>
            </template>
          </UPopover>
        </div>
      </div>
    </div>
    <ul v-else class="flex flex-col gap-2" :aria-label="label" data-ds="heat-cards">
      <li v-for="row in rows" :key="row.id" class="flex flex-col gap-2 rounded-card bg-default p-3">
        <span class="text-label text-highlighted">{{ row.label }}</span>
        <ul class="grid grid-cols-3 gap-2">
          <li
            v-for="(c, i) in columns"
            :key="i"
            class="flex flex-col gap-1 rounded-chip p-2"
            :class="[bg(row.cells[i] ?? null), fg(row.cells[i] ?? null)]"
          >
            <span class="truncate text-caption">{{ c }}</span>
            <span class="tabular text-label font-bold">{{ text(row.cells[i] ?? null) }}</span>
          </li>
        </ul>
      </li>
    </ul>
    <div v-if="!loading && legend" class="flex items-center gap-2 text-caption text-muted" data-ds="heat-legend">
      <span>{{ lowLabel }}</span>
      <span v-for="(cls, i) in ramp" :key="i" class="size-4 rounded-chip" :class="cls" aria-hidden="true" />
      <span>{{ highLabel }}</span>
    </div>
  </div>
</template>
