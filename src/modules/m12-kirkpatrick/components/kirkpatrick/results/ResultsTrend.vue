<script setup lang="ts">
/**
 * "Trend GPS ({a}–{b})" (FN-M12-6.4.1; FR-M12-51; BR-M12-20): Subjek · one column per year · Trend. The first row
 * "Keseluruhan" is highlighted. Values <= 4.00 are success, above warning; a missing value is "-" dimmed
 * (DV-M12-14); every Trend cell is the success up arrow as live. Staff table (`DsDataTable`).
 */
import { computed, ref } from 'vue'
import type { TableColumn } from '@nuxt/ui'

import { DsDataTable, DsPanel } from '@/ds'

import { gps } from '../common/kirkpatrick-format'
import ResultsTrendValue from './ResultsTrendValue.vue'
import type { ResultsTrend } from './results-types'

const props = defineProps<{ trend: ResultsTrend }>()

/** "Trend GPS (a–b)"; without years the heading has no "(range)" part (DV-M12-36). */
const title = computed(() => {
  const years = props.trend.years
  return years.length === 0 ? 'Trend GPS' : `Trend GPS (${years[0]}–${years[years.length - 1]})`
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

/** The GPS number and its label of year column `c` (slot rows are untyped). */
const valueOf = (row: Row, c: number) => row[`v${c}`] as number | null
const textOf = (row: Row, c: number) => row[`t${c}`] as string

const columns = computed<TableColumn<Row>[]>(() => [
  { accessorKey: 'name', header: 'Subjek' },
  ...props.trend.years.map((y, c) => ({ accessorKey: `t${c}`, header: String(y) })),
  { accessorKey: 'trend', header: 'Trend' },
])

/** Paged at 20 rows. */
const PAGE_SIZES = [10, 20, 50]
const pageSize = ref(20)
</script>

<template>
  <DsPanel :title="title" icon="i-ph-chart-line" data-testid="res-trend">
    <DsDataTable
      v-model:page-size="pageSize"
      variant="bare"
      :page-size-options="PAGE_SIZES"
      :data="rows"
      :columns="columns"
      caption="Trend GPS mengikut subjek"
    >
      <template #name-cell="{ row }">
        <span
          :class="['text-label', row.original.first ? 'text-primary-t' : 'text-highlighted']"
          data-testid="res-trend-row"
          >{{ row.original.name }}</span
        >
      </template>
      <template v-for="(_, c) in trend.years" :key="c" #[`t${c}-cell`]="{ row }">
        <ResultsTrendValue :value="valueOf(row.original, c)" :text="textOf(row.original, c)" />
      </template>
      <template #card="{ row }">
        <UButton
          type="button"
          color="neutral"
          variant="link"
          class="h-auto min-h-11 justify-start p-0 text-start text-label whitespace-normal"
        >
          <span
            :class="['text-label', row.first ? 'text-primary-t' : 'text-highlighted']"
            data-testid="res-trend-row"
            >{{ row.name }}</span
          >
        </UButton>
        <dl class="grid grid-cols-2 gap-x-3 gap-y-1">
          <div v-for="(year, c) in trend.years" :key="c" class="min-w-0">
            <dt class="text-caption text-muted">{{ year }}</dt>
            <dd class="tabular text-body break-words whitespace-normal">
              <ResultsTrendValue :value="valueOf(row, c)" :text="textOf(row, c)" />
            </dd>
          </div>
        </dl>
      </template>
      <template #trend-cell>
        <UIcon name="i-ph-arrow-up" class="size-4 text-success" />
      </template>
    </DsDataTable>
    <p class="flex items-start gap-2 px-1 pt-3 text-caption text-muted">
      <UIcon name="i-ph-info" class="mt-1 size-4 shrink-0" />↑ = GPS menurun (improving). Sumber:
      Headcount OTR & SPM sebenar.
    </p>
  </DsPanel>
</template>
