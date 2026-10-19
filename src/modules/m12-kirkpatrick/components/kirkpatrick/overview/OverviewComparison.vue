<script setup lang="ts">
/**
 * S1 "Perbandingan Sebelum & Selepas" (FN-M12-2.4.1..2.4.4; FR-M12-26..28): subtitle, the SEBELUM / SELEPAS
 * panels (side by side from `md`), four delta tiles (2 x 2 below `md`) and the "Ringkasan:" box. A panel
 * without data shows "-" ranges and 0 values; no data at all gives the "Tiada Data vs Tiada Data" state.
 */
import { computed } from 'vue'

import { DsPanel } from '@/ds'

import { formatPercent } from '@/lib/number'

import type { Comparison, ComparisonPanel } from '../../../api/types'
import { count, dateEn, pct, plain } from '../common'

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
  <DsPanel
    title="Perbandingan Sebelum & Selepas"
    icon="i-ph-arrows-left-right"
    data-testid="kirk-comparison"
  >
    <div class="flex flex-col gap-3">
      <p class="text-body text-muted" data-testid="kirk-comparison-subtitle">
        {{ comparison.subtitle }}
      </p>
      <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
        <UCard variant="soft" class="min-w-0" data-testid="kirk-panel-before">
          <div class="mb-2 flex flex-wrap items-center justify-between gap-1">
            <p class="text-label text-highlighted">SEBELUM</p>
            <p class="text-body text-muted" data-testid="kirk-panel-range">
              {{ range(comparison.before) }}
            </p>
          </div>
          <div class="grid grid-cols-2 gap-3 text-center">
            <div v-for="m in metrics(comparison.before)" :key="m.key" class="min-w-0">
              <p class="tabular text-heading text-highlighted" data-testid="kirk-panel-value">
                {{ m.value }}
              </p>
              <p class="text-body text-muted">{{ m.label }}</p>
            </div>
          </div>
        </UCard>
        <UCard variant="soft" class="min-w-0" data-testid="kirk-panel-after">
          <div class="mb-2 flex flex-wrap items-center justify-between gap-1">
            <p class="text-label text-primary-t">SELEPAS</p>
            <p class="text-body text-muted" data-testid="kirk-panel-range">
              {{ range(comparison.after) }}
            </p>
          </div>
          <div class="grid grid-cols-2 gap-3 text-center">
            <div v-for="m in metrics(comparison.after)" :key="m.key" class="min-w-0">
              <p class="tabular text-heading text-primary-t" data-testid="kirk-panel-value">
                {{ m.value }}
              </p>
              <p class="text-body text-muted">{{ m.label }}</p>
            </div>
          </div>
        </UCard>
      </div>

      <div class="grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="kirk-deltas">
        <UCard
          v-for="d in deltas"
          :key="d.key"
          variant="soft"
          class="min-w-0"
          :data-testid="`kirk-delta-${d.key}`"
          :data-tone="d.n >= 0 ? 'up' : 'down'"
        >
          <div class="flex flex-col items-center gap-1 text-center">
            <UIcon
              :name="d.n >= 0 ? 'i-ph-arrow-up' : 'i-ph-arrow-down'"
              :class="['size-5', d.n >= 0 ? 'text-success' : 'text-error']"
            />
            <p
              :class="['tabular text-label', d.n >= 0 ? 'text-success' : 'text-error']"
              data-testid="kirk-delta-value"
            >
              {{ d.text }}
            </p>
            <p class="text-body text-muted">{{ d.label }}</p>
          </div>
        </UCard>
      </div>

      <UAlert color="primary" variant="soft" icon="i-ph-chart-line" data-testid="kirk-summary">
        <template #description>
          <strong>Ringkasan:</strong> {{ comparison.sentences.join(' ') }}
        </template>
      </UAlert>
    </div>
  </DsPanel>
</template>
