<script setup lang="ts">
/**
 * S1 "Perbandingan Sebelum & Selepas" (FN-M12-2.4.1..2.4.4; FR-M12-26..28): subtitle, the SEBELUM / SELEPAS
 * panels (side by side from `md`), four delta tiles (2 x 2 below `md`) and the "Ringkasan:" box. A panel
 * without data shows "-" ranges and 0 values; no data at all gives the "Tiada Data vs Tiada Data" state.
 */
import { ArrowDown, ArrowLeftRight, ArrowUp, ChartLine } from '@lucide/vue'
import { computed } from 'vue'

import type { Comparison, ComparisonPanel } from '../../../api/types'
import { CARD, count, dateEn, pct, plain } from '../common'
import { formatPercent } from '@/lib/number'

const props = defineProps<{ comparison: Comparison }>()

const range = (p: ComparisonPanel | null) =>
  p === null ? '-' : `${dateEn(p.from)} - ${dateEn(p.to)}`

interface Metric {
  key: string
  label: string
  value: string
}
const metrics = (p: ComparisonPanel | null): Metric[] => [
  { key: 'active', label: 'Pelajar Aktif', value: plain(p?.active ?? 0) },
  { key: 'accuracy', label: 'Ketepatan', value: pct(p?.accuracy ?? 0) },
  { key: 'answers', label: 'Jumlah Jawapan', value: count(p?.answers ?? 0) },
  { key: 'champions', label: 'Champion', value: plain(p?.champions ?? 0) },
]

/** "+56" for a gain, "-11" for a loss, "0" otherwise (no separator, as live). */
const signed = (n: number) => (n > 0 ? `+${plain(n)}` : plain(n))

const deltas = computed(() => {
  const d = props.comparison.delta
  return [
    { key: 'active', label: 'Pelajar Aktif', n: d?.active ?? 0, text: signed(d?.active ?? 0) },
    {
      key: 'accuracy',
      label: 'Ketepatan',
      n: d?.accuracy ?? 0,
      text: formatPercent(d?.accuracy ?? 0, { decimals: 1, dropZeroFraction: true, signed: true }),
    },
    { key: 'answers', label: 'Jumlah Jawapan', n: d?.answers ?? 0, text: signed(d?.answers ?? 0) },
    {
      key: 'champions',
      label: 'Champion',
      n: d?.champions ?? 0,
      text: signed(d?.champions ?? 0),
    },
  ]
})
</script>

<template>
  <section :class="[CARD, 'p-3 sm:p-5']" data-testid="kirk-comparison">
    <h2 class="flex items-center gap-2 font-heading text-base font-bold text-slate-800">
      <ArrowLeftRight class="h-5 w-5 text-indigo-600" />Perbandingan Sebelum &amp; Selepas
    </h2>
    <p class="mb-3 text-sm text-slate-400" data-testid="kirk-comparison-subtitle">
      {{ comparison.subtitle }}
    </p>

    <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
      <div
        class="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3"
        data-testid="kirk-panel-before"
      >
        <div class="mb-2 flex flex-wrap items-center justify-between gap-1">
          <p class="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <span class="h-3 w-3 rounded-full bg-slate-400" />SEBELUM
          </p>
          <p class="text-xs text-slate-400" data-testid="kirk-panel-range">
            {{ range(comparison.before) }}
          </p>
        </div>
        <div class="grid grid-cols-2 gap-y-3 text-center">
          <div v-for="m in metrics(comparison.before)" :key="m.key" class="min-w-0">
            <p
              class="font-heading text-xl font-bold text-slate-700 sm:text-2xl"
              data-testid="kirk-panel-value"
            >
              {{ m.value }}
            </p>
            <p class="text-xs text-slate-400">{{ m.label }}</p>
          </div>
        </div>
      </div>
      <div
        class="min-w-0 rounded-xl border border-indigo-200 bg-indigo-50 p-3"
        data-testid="kirk-panel-after"
      >
        <div class="mb-2 flex flex-wrap items-center justify-between gap-1">
          <p class="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <span class="h-3 w-3 rounded-full bg-indigo-500" />SELEPAS
          </p>
          <p class="text-xs text-slate-400" data-testid="kirk-panel-range">
            {{ range(comparison.after) }}
          </p>
        </div>
        <div class="grid grid-cols-2 gap-y-3 text-center">
          <div v-for="m in metrics(comparison.after)" :key="m.key" class="min-w-0">
            <p
              class="font-heading text-xl font-bold text-indigo-600 sm:text-2xl"
              data-testid="kirk-panel-value"
            >
              {{ m.value }}
            </p>
            <p class="text-xs text-slate-400">{{ m.label }}</p>
          </div>
        </div>
      </div>
    </div>

    <div class="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="kirk-deltas">
      <div
        v-for="d in deltas"
        :key="d.key"
        :class="[
          'flex min-w-0 flex-col items-center rounded-xl border bg-white p-3 text-center',
          d.n >= 0 ? 'border-green-200' : 'border-red-200',
        ]"
        :data-testid="`kirk-delta-${d.key}`"
        :data-tone="d.n >= 0 ? 'up' : 'down'"
      >
        <ArrowUp v-if="d.n >= 0" class="h-5 w-5 text-green-500" />
        <ArrowDown v-else class="h-5 w-5 text-red-500" />
        <p
          :class="['text-sm font-semibold', d.n >= 0 ? 'text-green-600' : 'text-red-600']"
          data-testid="kirk-delta-value"
        >
          {{ d.text }}
        </p>
        <p class="text-xs text-slate-400">{{ d.label }}</p>
      </div>
    </div>

    <p class="mt-3 rounded-xl bg-indigo-50 p-3 text-sm text-slate-700" data-testid="kirk-summary">
      <ChartLine class="mr-1 inline h-4 w-4 text-indigo-600" /><strong>Ringkasan:</strong>
      {{ comparison.sentences.join(' ') }}
    </p>
  </section>
</template>
