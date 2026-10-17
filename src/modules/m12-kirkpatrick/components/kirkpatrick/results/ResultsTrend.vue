<script setup lang="ts">
/**
 * "Trend GPS ({a}–{b})" (FN-M12-6.4.1; FR-M12-51; BR-M12-20): Subjek · one column per year · Trend. The first row
 * "Keseluruhan" is highlighted. Values <= 4.00 are success, above warning; a missing value is "-" dimmed
 * (DV-M12-14); every Trend cell is the success up arrow as live. Staff table (`DsDataTable`).
 */
import { computed } from 'vue'
import type { TableColumn } from '@nuxt/ui'

import { DsDataTable } from '@/ds'

import KirkpatrickTableSection from '../common/KirkpatrickTableSection.vue'
import { gps } from '../common/kirkpatrick-format'
import { gpsText } from './results-format'
import type { ResultsTrend } from './results-types'

const props = defineProps<{ trend: ResultsTrend }>()

const range = computed(() => {
  const years = props.trend.years
  return `${years[0] ?? ''}–${years[years.length - 1] ?? ''}`
})

interface Row extends Record<string, unknown> {
  name: string
  first: boolean
  trend: string
}

const rows = computed<Row[]>(() =>
  props.trend.rows.map((r, i) => {
    const row: Row = { name: r.name, first: i === 0, trend: '' }
    r.values.forEach((v, c) => {
      row[`v${c}`] = v
      row[`t${c}`] = v === null ? '-' : gps(v)
    })
    return row
  }),
)

const columns = computed<TableColumn<Row>[]>(() => [
  { accessorKey: 'name', header: 'Subjek' },
  ...props.trend.years.map((y, c) => ({ accessorKey: `t${c}`, header: String(y) })),
  { accessorKey: 'trend', header: 'Trend' },
])
const cardFields = computed(() => [
  ...props.trend.years.map((y, c) => ({ key: `t${c}`, label: String(y) })),
])
</script>

<template>
  <KirkpatrickTableSection
    :title="`Trend GPS (${range})`"
    icon="i-ph-chart-line"
    footnote="↑ = GPS menurun (improving). Sumber: Headcount OTR & SPM sebenar."
    data-testid="res-trend"
  >
    <DsDataTable
      :data="rows"
      :columns="columns"
      caption="Trend GPS mengikut subjek"
      card-title="name"
      :card-fields="cardFields"
      :page-size="1000"
    >
      <template #name-cell="{ row }">
        <span
          :class="['text-label', row.original.first ? 'text-primary' : 'text-highlighted']"
          data-testid="res-trend-row"
          >{{ row.original.name }}</span
        >
      </template>
      <template v-for="(_, c) in trend.years" :key="c" #[`t${c}-cell`]="{ row }">
        <span
          :class="[
            'text-label',
            row.original[`v${c}`] === null ? 'text-dimmed' : gpsText(row.original[`v${c}`] as number),
          ]"
          data-testid="res-trend-cell"
          >{{ row.original[`t${c}`] }}</span
        >
      </template>
      <template #trend-cell>
        <UIcon name="i-ph-arrow-up" class="size-4 text-success" />
      </template>
    </DsDataTable>
  </KirkpatrickTableSection>
</template>
