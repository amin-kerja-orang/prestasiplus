<script setup lang="ts">
/**
 * Heat grid: CSS-grid colour-scale cells, a 5-step single-hue ramp starting at `bg-elevated`
 * (staff ends in kobalt, learner in the A3 orange). Every cell prints its percentage, is
 * keyboard-focusable and opens a popover with the details. A legend explains the ramp. Below
 * `md` it falls back to a list of cards (one per row).
 *
 * `bands` (optional, 2 to 4 items, ascending by `min`) switches the colours from the 5 even steps to
 * status bands: a value takes the band with the highest `min` it reaches (lightest tint for the
 * lowest band, the solid colour for the highest), and the legend becomes one swatch + label per band
 * (highest first) plus the empty cell, so the legend always matches the cells. Cells keep a 44px
 * minimum width and height; the grid scrolls inside its own container when the columns do not fit.
 */
import { computed } from 'vue'

import { dsCopy } from './copy'
import { usePersonality } from './personality'
import { useMedia } from './useMedia'

export interface HeatBand {
  /** Lowest value (0-100) of the band. */
  min: number
  /** Legend text of the band (BM). */
  label: string
}

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
    /** Status bands (ascending by `min`); absent = 5 even 20-point steps with a low-to-high legend. */
    bands?: HeatBand[]
    /** Text of the empty cell (BM). */
    noDataLabel?: string
    /** Skeleton in place of the grid. */
    loading?: boolean
  }>(),
  {
    lowLabel: dsCopy.heatLow,
    highLabel: dsCopy.heatHigh,
    unit: '%',
    noDataLabel: dsCopy.heatNoData,
    loading: false,
    bands: undefined,
  },
)

const personality = usePersonality()
const wide = useMedia('(min-width: 768px)')

const STAFF = ['bg-elevated', 'bg-primary/15', 'bg-primary/35', 'bg-primary/60', 'bg-primary']
const LEARNER = ['bg-elevated', 'bg-heat/15', 'bg-heat/35', 'bg-heat/60', 'bg-heat']
const STAFF_TEXT = ['text-highlighted', 'text-highlighted', 'text-highlighted', 'text-highlighted', 'text-primary-on']
const LEARNER_TEXT = ['text-highlighted', 'text-highlighted', 'text-highlighted', 'text-highlighted', 'text-on-sem']

const ramp = computed(() => (personality.value === 'learner' ? LEARNER : STAFF))
const rampText = computed(() => (personality.value === 'learner' ? LEARNER_TEXT : STAFF_TEXT))

/**
 * Row label (capped 7-14rem, wraps) + N columns of at least 44px (2.75rem), N = 1 to 11. Literal
 * classes so the class linter can read them.
 */
const GRID_COLS = [
  'grid-cols-[minmax(7rem,14rem)_repeat(1,minmax(2.75rem,1fr))]',
  'grid-cols-[minmax(7rem,14rem)_repeat(2,minmax(2.75rem,1fr))]',
  'grid-cols-[minmax(7rem,14rem)_repeat(3,minmax(2.75rem,1fr))]',
  'grid-cols-[minmax(7rem,14rem)_repeat(4,minmax(2.75rem,1fr))]',
  'grid-cols-[minmax(7rem,14rem)_repeat(5,minmax(2.75rem,1fr))]',
  'grid-cols-[minmax(7rem,14rem)_repeat(6,minmax(2.75rem,1fr))]',
  'grid-cols-[minmax(7rem,14rem)_repeat(7,minmax(2.75rem,1fr))]',
  'grid-cols-[minmax(7rem,14rem)_repeat(8,minmax(2.75rem,1fr))]',
  'grid-cols-[minmax(7rem,14rem)_repeat(9,minmax(2.75rem,1fr))]',
  'grid-cols-[minmax(7rem,14rem)_repeat(10,minmax(2.75rem,1fr))]',
  'grid-cols-[minmax(7rem,14rem)_repeat(11,minmax(2.75rem,1fr))]',
]
const gridCols = computed(
  () => GRID_COLS[Math.min(Math.max(props.columns.length, 1), GRID_COLS.length) - 1] ?? GRID_COLS[0],
)

/** The empty cell: grey with a dashed edge, so it never reads as the lightest band. */
const NO_DATA = 'border border-dashed border-accented'

/** Ramp index of each band (index 0 is the empty cell), lowest band first, by band count. */
const BAND_STEPS: Record<number, number[]> = { 2: [1, 4], 3: [1, 3, 4], 4: [1, 2, 3, 4] }

/** The band a value falls in (0 = lowest), or -1 when no bands are set. */
function bandOf(v: number): number {
  const list = props.bands
  if (!list || !BAND_STEPS[list.length]) return -1
  let found = 0
  list.forEach((b, i) => {
    if (v >= b.min) found = i
  })
  return found
}

function step(v: number | null): number {
  if (v === null) return 0
  const band = bandOf(v)
  if (band >= 0) return BAND_STEPS[props.bands?.length ?? 0]?.[band] ?? 0
  return Math.min(4, Math.max(0, Math.floor(v / 20)))
}
/** Legend of the bands, highest first, then the empty cell. */
const bandLegend = computed(() => {
  const list = props.bands
  const steps = list ? BAND_STEPS[list.length] : undefined
  if (!list || !steps) return []
  const items = list.map((b, i) => ({ label: b.label, cls: ramp.value[steps[i] ?? 0] ?? 'bg-elevated' }))
  return [
    ...items.reverse(),
    { label: props.noDataLabel, cls: `${ramp.value[0] ?? 'bg-elevated'} ${NO_DATA}` },
  ]
})

function bg(v: number | null): string {
  const cls = ramp.value[step(v)] ?? 'bg-elevated'
  return v === null ? `${cls} ${NO_DATA}` : cls
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
          <span class="flex min-h-11 items-center pe-2 text-label text-highlighted">
            {{ row.label }}
          </span>
          <UPopover v-for="(_, c) in columns" :key="c">
            <UButton
              type="button"
              color="neutral"
              variant="ghost"
              class="tabular min-h-11 min-w-11 justify-center rounded-chip text-label font-bold"
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
            class="flex min-h-11 flex-col gap-1 rounded-chip p-2"
            :class="[bg(row.cells[i] ?? null), fg(row.cells[i] ?? null)]"
            data-ds="heat-card-cell"
          >
            <span class="truncate text-caption">{{ c }}</span>
            <span class="tabular text-label font-bold">{{ text(row.cells[i] ?? null) }}</span>
          </li>
        </ul>
      </li>
    </ul>
    <ul
      v-if="!loading && bandLegend.length > 0"
      class="flex flex-wrap items-center gap-x-4 gap-y-2 text-caption text-default"
      :aria-label="dsCopy.heatLegend"
      data-ds="heat-legend"
    >
      <li v-for="(item, i) in bandLegend" :key="i" class="flex items-center gap-2">
        <span
          class="size-5 shrink-0 rounded-chip"
          :class="item.cls"
          aria-hidden="true"
          data-ds="heat-legend-swatch"
        />{{ item.label }}
      </li>
    </ul>
    <div v-else-if="!loading" class="flex items-center gap-2 text-caption text-muted" data-ds="heat-legend">
      <span>{{ lowLabel }}</span>
      <span v-for="(cls, i) in ramp" :key="i" class="size-4 rounded-chip" :class="cls" aria-hidden="true" />
      <span>{{ highLabel }}</span>
    </div>
  </div>
</template>
