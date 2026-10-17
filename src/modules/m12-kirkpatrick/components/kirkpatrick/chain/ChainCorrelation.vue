<script setup lang="ts">
/**
 * "Analisis Korelasi: Penggunaan → Pencapaian" (FN-M12-7.3.1 / 7.3.2; FR-M12-67 / 68): the three constant rows with the bar
 * (warning below 60, success otherwise; DV-M12-02) and the "Kesimpulan ALESA:" box. The
 * difference is 100+ minus 1-20, one decimal, signed.
 */
import { computed } from 'vue'
import type { TableColumn } from '@nuxt/ui'

import { DsDataTable } from '@/ds'
import { formatNumber } from '@/lib/number'

import type { Chain } from '../../../api/types'
import KirkpatrickPanel from '../common/KirkpatrickPanel.vue'
import { pct, plain } from '../common/kirkpatrick-format'

const props = defineProps<{
  correlation: Chain['correlation']
  strength: Chain['t4']['strength']
}>()

const low = computed(
  () =>
    props.correlation.bands.find((b) => b.label === '1-20 soalan') ?? props.correlation.bands[0],
)
const high = computed(
  () =>
    props.correlation.bands.find((b) => b.label === '100+ soalan') ??
    props.correlation.bands[props.correlation.bands.length - 1],
)
const diff = computed(() =>
  formatNumber((high.value?.acc ?? 0) - (low.value?.acc ?? 0), { decimals: 1, signed: true }),
)

interface Row extends Record<string, unknown> {
  label: string
  students: string
  accuracy: string
  acc: number
}
const rows = computed<Row[]>(() =>
  props.correlation.bands.map((b) => ({
    label: b.label,
    students: plain(b.n),
    accuracy: pct(b.acc),
    acc: b.acc,
  })),
)
const columns: TableColumn<Row>[] = [
  { accessorKey: 'label', header: 'Tahap Penggunaan' },
  { accessorKey: 'students', header: 'Bil. Pelajar' },
  { accessorKey: 'accuracy', header: 'Purata Ketepatan' },
  { accessorKey: 'acc', header: 'Visual' },
]
const cardFields = [
  { key: 'students', label: 'Bil. Pelajar' },
  { key: 'accuracy', label: 'Purata Ketepatan' },
]
</script>

<template>
  <KirkpatrickPanel
    title="Analisis Korelasi: Penggunaan → Pencapaian"
    icon="i-ph-chart-line-up"
    data-testid="chain-correlation"
  >
    <div class="flex flex-col gap-4">
      <DsDataTable
        :data="rows"
        :columns="columns"
        caption="Analisis korelasi penggunaan dan pencapaian"
        card-title="label"
        :card-fields="cardFields"
        :page-size="100"
      >
        <template #label-cell="{ row }">
          <span data-testid="corr-row">{{ row.original.label }}</span>
        </template>
        <template #acc-cell="{ row }">
          <UProgress
            :model-value="row.original.acc"
            :max="100"
            :color="row.original.acc < 60 ? 'warning' : 'success'"
            size="sm"
            class="w-28"
            :aria-label="`${row.original.label} ${row.original.accuracy}`"
            data-testid="corr-bar"
          />
        </template>
      </DsDataTable>
      <UAlert color="primary" variant="soft" icon="i-ph-sparkle" data-testid="corr-conclusion">
        <template #description>
          <strong>Kesimpulan ALESA:</strong> Pelajar yang menjawab 100+ soalan mencapai ketepatan
          {{ pct(high?.acc ?? 0) }}, berbanding {{ pct(low?.acc ?? 0) }} bagi pelajar dengan kurang
          20 soalan (perbezaan {{ diff }}%). Korelasi Pearson antara penggunaan dan ketepatan: r =
          {{ correlation.r }} ({{ strength }}).
        </template>
      </UAlert>
    </div>
  </KirkpatrickPanel>
</template>
