<script setup lang="ts">
/**
 * Chart wrapper (restyle spec 1.5): Chart.js reading the DS colour tokens at mount and whenever
 * the colour mode or personality changes. No grid lines, rounded bars, value labels, a legend that
 * uses shape + label, fixed heights (220 / 280 / 320) and a visually hidden data table alternative.
 * Staff series use `--ds-cat-<slot>` (slot defaults to the series order, single series = kobalt);
 * learner series use A1, A4, A2, A3 in that order.
 */
import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  DoughnutController,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
  type ChartConfiguration,
  type Plugin,
} from 'chart.js'
import type { TableColumn } from '@nuxt/ui'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'

import { dsCopy, fillCopy } from './copy'
import { warnDeprecated } from './deprecate'
import DsEmptyState from './DsEmptyState.vue'
import DsLoadError from './DsLoadError.vue'
import { usePersonality } from './personality'
import type { DsHeadingLevel } from './types'

Chart.register(
  BarController,
  BarElement,
  LineController,
  LineElement,
  PointElement,
  DoughnutController,
  ArcElement,
  CategoryScale,
  LinearScale,
  Legend,
  Tooltip,
)

export interface ChartSeries {
  label: string
  data: number[]
  /** Staff colour slot 1-8 (`--ds-cat-<slot>`). Defaults to the series position. */
  slot?: number
}

const props = withDefaults(
  defineProps<{
    type?: 'bar' | 'line' | 'doughnut'
    /** Visible chart title (BM). */
    title: string
    labels: string[]
    series: ChartSeries[]
    /** Appended to value labels and tooltips, e.g. "%". */
    unit?: string
    /** Horizontal bars. */
    horizontal?: boolean
    /** Caption of the hidden data table (BM). */
    tableLabel?: string
    /** Heading level of the title. */
    headingLevel?: DsHeadingLevel
    /** @deprecated use `headingLevel`. */
    level?: DsHeadingLevel
    /** Fixed plot height (220 / 280 / 320); unset = 220 growing to 320 with the viewport. */
    height?: 'sm' | 'md' | 'lg'
    loading?: boolean
    /** Failed to load: a retryable error replaces the plot. */
    error?: boolean
    errorMessage?: string
    /** Text of the empty state (no data for the period). */
    emptyLabel?: string
  }>(),
  {
    type: 'bar',
    unit: '',
    horizontal: false,
    tableLabel: undefined,
    headingLevel: undefined,
    level: undefined,
    height: undefined,
    loading: false,
    error: false,
    errorMessage: undefined,
    emptyLabel: dsCopy.chartEmpty,
  },
)

const emit = defineEmits<{ retry: [] }>()
if (props.level) warnDeprecated('DsChart', 'level', 'headingLevel')

const isEmpty = computed(
  () => props.series.length === 0 || props.series.every((s) => s.data.length === 0),
)
const view = computed<'loading' | 'error' | 'empty' | 'ready'>(() =>
  props.loading ? 'loading' : props.error ? 'error' : isEmpty.value ? 'empty' : 'ready',
)
const HEIGHT = { sm: 'h-55', md: 'h-70', lg: 'h-80' } as const
const plotHeight = computed(() => (props.height ? HEIGHT[props.height] : 'h-55 md:h-70 lg:h-80'))

const personality = usePersonality()
const root = useTemplateRef<HTMLElement>('root')
const canvas = useTemplateRef<HTMLCanvasElement>('canvas')

/** Used when the chart sits outside any `[data-personality]` scope (older shells), where `--ds-cat-*` is unset. */
const CAT_FALLBACK = [
  '--color-kobalt-600',
  '--color-limau-800',
  '--color-delima-700',
  '--color-laut-700',
  '--color-mentari-800',
  '--color-heat',
  '--color-ungu-600',
  '--color-daun-700',
]
const LEARNER_VARS = ['--ds-c1', '--ds-c4', '--ds-c2', '--ds-c3']
const colours = ref<string[]>([])
const dimmed = ref('')
const swatch = computed(() =>
  personality.value === 'learner'
    ? ['bg-primary', 'bg-friend', 'bg-highlight', 'bg-heat']
    : ['bg-cat-1', 'bg-cat-2', 'bg-cat-3', 'bg-cat-4', 'bg-cat-5', 'bg-cat-6', 'bg-cat-7', 'bg-cat-8'],
)
const legend = computed(() =>
  props.type === 'doughnut'
    ? props.labels.map((label, i) => ({ label, swatch: swatch.value[i % swatch.value.length] }))
    : props.series.map((s, i) => ({
        label: s.label,
        swatch: swatch.value[(personality.value === 'learner' ? i : (s.slot ?? i + 1) - 1) % swatch.value.length],
      })),
)
const shape = computed(() =>
  props.type === 'line' ? 'rounded-full' : props.type === 'doughnut' ? 'rounded-full' : 'rounded-chip',
)

function readTokens(): void {
  const el = root.value
  if (!el || typeof getComputedStyle !== 'function') return
  const cs = getComputedStyle(el)
  const get = (v: string): string => cs.getPropertyValue(v).trim()
  const pool =
    personality.value === 'learner'
      ? LEARNER_VARS.map(get)
      : [1, 2, 3, 4, 5, 6, 7, 8].map(
          (n) => get(`--ds-cat-${n}`) || get(CAT_FALLBACK[n - 1] ?? '') || get('--ui-primary'),
        )
  colours.value = pool
  dimmed.value = get('--ui-text-dimmed')
}

function seriesColour(i: number): string {
  const pool = colours.value
  if (!pool.length) return ''
  const s = props.series[i]
  const idx = personality.value === 'learner' ? i : (s?.slot ?? i + 1) - 1
  return pool[idx % pool.length] ?? ''
}

/** Value labels on bars and at the end of lines (no tooltips needed to read values). */
const valueLabels: Plugin = {
  id: 'dsValueLabels',
  afterDatasetsDraw(chart) {
    if (props.type === 'doughnut') return
    const { ctx } = chart
    ctx.save()
    ctx.fillStyle = dimmed.value
    ctx.font = '600 12px sans-serif'
    ctx.textAlign = 'center'
    chart.data.datasets.forEach((ds, di) => {
      const meta = chart.getDatasetMeta(di)
      meta.data.forEach((el, i) => {
        if (props.type === 'line' && i !== meta.data.length - 1) return
        const v = ds.data[i]
        if (typeof v !== 'number') return
        const text = `${v}${props.unit}`
        const p = el.getProps(['x', 'y'], true)
        if (props.horizontal) {
          ctx.textAlign = 'left'
          ctx.fillText(text, p.x + 6, p.y + 4)
        } else {
          ctx.textAlign = 'center'
          ctx.fillText(text, p.x, p.y - 6)
        }
      })
    })
    ctx.restore()
  },
}

function build(): ChartConfiguration {
  const tick = { color: dimmed.value, font: { size: 12 } }
  const doughnut = props.type === 'doughnut'
  const datasets = props.series.map((s, i) => ({
    label: s.label,
    data: s.data,
    backgroundColor: doughnut ? colours.value.slice(0, s.data.length) : seriesColour(i),
    borderColor: doughnut ? 'transparent' : seriesColour(i),
    borderWidth: props.type === 'line' ? 2 : 0,
    borderRadius: props.type === 'bar' ? 4 : 0,
    tension: 0.3,
    pointRadius: props.type === 'line' ? 3 : 0,
  }))
  return {
    type: props.type,
    data: { labels: props.labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: props.horizontal ? 'y' : 'x',
      layout: { padding: { top: 18, right: props.horizontal ? 32 : 8 } },
      plugins: { legend: { display: false } },
      scales: doughnut
        ? {}
        : {
            x: { grid: { display: false }, border: { display: false }, ticks: tick },
            y: {
              grid: { display: false },
              border: { display: false },
              ticks: tick,
              beginAtZero: true,
            },
          },
    },
    plugins: [valueLabels],
  }
}

let chart: Chart | null = null
function render(): void {
  readTokens()
  chart?.destroy()
  chart = null
  const el = canvas.value
  if (!el || !el.getContext?.('2d')) return
  chart = new Chart(el, build())
}

let observer: MutationObserver | undefined
onMounted(() => {
  render()
  if (typeof MutationObserver === 'function') {
    observer = new MutationObserver(render)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-personality'],
    })
  }
})
onBeforeUnmount(() => {
  observer?.disconnect()
  chart?.destroy()
  chart = null
})
watch(() => [props.type, props.labels, props.series, props.unit, props.horizontal, personality.value], render, {
  deep: true,
})

const tableColumns = computed<TableColumn<Record<string, string>>[]>(() => [
  { accessorKey: 'label', header: '' },
  ...props.series.map((s, i) => ({ accessorKey: `s${i}`, header: s.label })),
])
const tableRows = computed(() =>
  props.labels.map((label, r) => {
    const row: Record<string, string> = { label }
    props.series.forEach((s, i) => {
      row[`s${i}`] = `${s.data[r] ?? ''}${props.unit}`
    })
    return row
  }),
)

const headingTag = computed(() => `h${props.headingLevel ?? props.level ?? 3}`)

// The canvas stays mounted (hidden) while loading / empty / error; redraw when the plot is back.
watch(view, async (v) => {
  if (v !== 'ready') return
  await nextTick()
  render()
})
</script>

<template>
  <figure
    ref="root"
    class="m-0 flex min-w-0 flex-col gap-3"
    :aria-busy="loading ? 'true' : undefined"
    :data-state="view"
    data-ds="chart"
  >
    <component :is="headingTag" class="text-subheading text-highlighted" data-ds="chart-title">
      {{ title }}
    </component>
    <USkeleton v-if="view === 'loading'" class="w-full" :class="plotHeight" data-ds="chart-loading" />
    <DsLoadError
      v-else-if="view === 'error'"
      :message="errorMessage"
      variant="inline"
      @retry="emit('retry')"
    />
    <DsEmptyState v-else-if="view === 'empty'" size="sm" :title="emptyLabel" icon="chart-line-up" />
    <div v-show="view === 'ready'" class="relative w-full" :class="plotHeight">
      <canvas ref="canvas" role="img" :aria-label="title" />
    </div>
    <ul
      v-if="view === 'ready'"
      class="flex flex-wrap gap-x-4 gap-y-2" data-ds="chart-legend" :aria-label="fillCopy(dsCopy.chartLegend, { title })">
      <li v-for="(l, i) in legend" :key="i" class="flex items-center gap-2 text-caption text-muted">
        <span class="size-3 shrink-0" :class="[l.swatch, shape]" aria-hidden="true" />
        {{ l.label }}
      </li>
    </ul>
    <UTable
      class="sr-only"
      :data="tableRows"
      :columns="tableColumns"
      :caption="tableLabel ?? fillCopy(dsCopy.chartTable, { title })"
      data-ds="chart-table"
    />
  </figure>
</template>
