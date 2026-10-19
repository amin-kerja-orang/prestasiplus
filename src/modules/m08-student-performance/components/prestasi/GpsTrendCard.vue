<script setup lang="ts">
/** S1 "📉 Trend GPS (5 Tahun)" (FR-M08-16, FR-M08-17): the `DsChart` line chart + the yearly table. */
import { computed } from 'vue'
import type { TableColumn } from '@nuxt/ui'

import { DsChart, DsDataTable, DsPanel, DsStack, DsHeading, DsText } from '@/ds'

import type { SchoolPerformance } from '../../api/types'
import { BAND_STYLE, dec2, grouped } from '../../lib/prestasi/format'
import { trendSeries } from '../../lib/prestasi/gps-chart'

const props = defineProps<{ trend: SchoolPerformance['trend'] }>()

type Band = NonNullable<SchoolPerformance['trend']['years'][number]['band']>
const bandStyle = (b: Band) => BAND_STYLE[b]

const chart = computed(() => trendSeries(props.trend.chart))

type Year = SchoolPerformance['trend']['years'][number]
interface Row extends Record<string, unknown> {
  year: number
  yearLabel: string
  current: boolean
  noData: boolean
  gpsText: string
  band: Year['band']
  candidatesText: string
  sourceText: string
  change: number | null
  changeText: string
}

const rows = computed<Row[]>(() =>
  props.trend.years.map((y) => {
    const noData = y.current || y.gps === null
    return {
      year: y.year,
      yearLabel: y.current ? `${y.year} Semasa` : String(y.year),
      current: y.current,
      noData,
      gpsText: noData || y.gps === null ? 'Tiada data' : dec2(y.gps),
      band: noData ? null : y.band,
      candidatesText: noData || y.candidates === null ? '—' : grouped(y.candidates),
      sourceText: noData ? '—' : (y.source ?? '—'),
      change: noData ? null : y.change,
      changeText:
        noData || y.change === null || y.change === 0
          ? '—'
          : y.change < 0
            ? `▼ ${dec2(Math.abs(y.change))}`
            : `▲ ${dec2(y.change)}`,
    }
  }),
)

const columns: TableColumn<Row>[] = [
  { accessorKey: 'yearLabel', header: 'Tahun' },
  { accessorKey: 'gpsText', header: 'GPS Keseluruhan' },
  { accessorKey: 'band', header: 'Tahap' },
  { accessorKey: 'candidatesText', header: 'Calon' },
  { accessorKey: 'sourceText', header: 'Sumber' },
  { accessorKey: 'changeText', header: 'Perubahan' },
]
const cardFields = [
  { key: 'gpsText', label: 'GPS Keseluruhan' },
  { key: 'candidatesText', label: 'Calon' },
  { key: 'sourceText', label: 'Sumber' },
  { key: 'changeText', label: 'Perubahan' },
]
</script>

<template>
  <DsPanel data-testid="trend-card">
    <DsStack>
      <DsStack gap="2xs">
        <DsHeading :level="2" variant="subheading">📉 Trend GPS (5 Tahun)</DsHeading>
        <DsText variant="caption">
          2022–2026 · lebih rendah = lebih baik · Nilai GPS: 0 (A+) paling baik, 9 (G) paling lemah.
        </DsText>
      </DsStack>
      <DsChart
        title="Trend GPS"
        type="line"
        :labels="chart.labels"
        :series="chart.series"
        table-label="Trend GPS mengikut tahun"
        data-testid="gps-trend-chart"
      />
      <DsDataTable
        :data="rows"
        :columns="columns"
        caption="Jadual trend GPS mengikut tahun"
        card-title="yearLabel"
        :card-fields="cardFields"
        :page-size="10"
        data-testid="trend-table"
      >
        <template #yearLabel-cell="{ row }">
          <DsText
            variant="label"
            tone="highlighted"
            class="whitespace-nowrap"
            :data-testid="`trend-row-${row.original.year}`"
          >
            {{ row.original.year }}
            <UBadge
              v-if="row.original.current"
              color="primary"
              variant="subtle"
              size="sm"
              label="Semasa"
            />
          </DsText>
        </template>
        <template #gpsText-cell="{ row }">
          <span
            :class="[
              row.original.band ? bandStyle(row.original.band).text : 'text-muted',
              'text-label',
            ]"
            >{{ row.original.gpsText }}</span
          >
        </template>
        <template #band-cell="{ row }">
          <UBadge
            v-if="row.original.band"
            :color="bandStyle(row.original.band).badge"
            variant="subtle"
            :label="row.original.band"
          />
          <span v-else class="text-dimmed">—</span>
        </template>
        <template #changeText-cell="{ row }">
          <span
            :class="
              row.original.change === null || row.original.change === 0
                ? 'text-dimmed'
                : row.original.change < 0
                  ? 'text-success'
                  : 'text-error'
            "
            >{{ row.original.changeText }}</span
          >
        </template>
      </DsDataTable>
    </DsStack>
  </DsPanel>
</template>
