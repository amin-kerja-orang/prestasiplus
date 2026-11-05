<script setup lang="ts">
/**
 * `/headcount/{id}/unjuran` "Unjuran" (S10-T02; R1-GUR-3 Forms, HC-6): a read-only table Nama · TOV · AR
 * terkini · Unjuran · Gred · Trend · Keyakinan and the class projection chart. The end value, grade,
 * trend and Keyakinan come from the API (`rows[].projection`); "—" where a pupil has no AR, TOV or ETR.
 */
import type { TableColumn } from '@nuxt/ui'
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import {
  DsBackLink,
  DsChart,
  DsDataTable,
  DsLoadError,
  DsPage,
  DsPageHeader,
  DsPanel,
  DsStack,
  type CardField,
} from '@/ds'

import { fetchHeadcountDetail } from '../api/headcount'
import type { HeadcountRow } from '../api/headcount-types'
import { classProjectionChart } from '../lib/headcount/charts'
import { DASH, gradeOfPercent, num0, num1 } from '../lib/headcount/format'
import { LOAD_ERROR, isLoadError, useRouteData } from '../lib/prestasi/load'
import { routeId } from '../lib/route-id'

const route = useRoute()
const id = computed(() => routeId(route.params.id))
const { data, error, reload } = useRouteData(
  (signal) => fetchHeadcountDetail(id.value, { signal }),
  [id],
)

interface Row extends Record<string, unknown> {
  userId: number
  index: string
  name: string
  tov: string
  ar: string
  end: string
  grade: string
  trend: string
  confidence: string
}

/** The latest AR of a pupil (Auto: whole number, Manual: 1 decimal). */
function latestAr(r: HeadcountRow, manual: boolean): string {
  for (let i = r.cells.length - 1; i >= 0; i--) {
    const ar = r.cells[i]?.ar
    if (ar !== null && ar !== undefined) return manual ? num1(ar) : num0(ar)
  }
  return DASH
}

const rows = computed<Row[]>(() => {
  const d = data.value
  if (!d) return []
  const manual = d.config.mode === 'manual'
  return d.rows
    .filter((r) => !r.dropped)
    .map((r, i) => {
      const p = r.projection
      return {
        userId: r.userId,
        index: String(i + 1),
        name: r.name,
        tov: r.tov === null ? DASH : num1(r.tov),
        ar: latestAr(r, manual),
        end: p ? `${num1(p.value)}%` : DASH,
        grade: p ? gradeOfPercent(p.value) : DASH,
        trend: p?.trend ?? DASH,
        confidence: p?.confidence ?? DASH,
      }
    })
})

const columns: TableColumn<Row>[] = [
  { accessorKey: 'name', header: 'Nama' },
  { accessorKey: 'tov', header: 'TOV' },
  { accessorKey: 'ar', header: 'AR terkini' },
  { accessorKey: 'end', header: 'Unjuran' },
  { accessorKey: 'grade', header: 'Gred' },
  { accessorKey: 'trend', header: 'Trend' },
  { accessorKey: 'confidence', header: 'Keyakinan' },
]

const CARD_FIELDS: CardField[] = columns.slice(1).map((c) => ({
  key: (c as { accessorKey: string }).accessorKey,
  label: c.header as string,
}))

const chart = computed(() => (data.value ? classProjectionChart(data.value) : null))
const subtitle = computed(() => {
  const c = data.value?.config
  return c ? `${c.subject} · ${c.className} · ${c.levelName} · ${String(c.year)}` : ''
})
</script>

<template>
  <DsPage data-testid="headcount-unjuran-page">
    <DsLoadError v-if="isLoadError(error)" :message="LOAD_ERROR" testid="page-error" @retry="reload()" />

    <template v-else-if="data">
      <DsPageHeader title="Unjuran" :subtitle="subtitle" subtitle-testid="unjuran-subtitle">
        <template #breadcrumb>
          <DsBackLink :to="`/headcount/${String(id)}`" label="Kembali" data-testid="back-link" />
        </template>
      </DsPageHeader>

      <DsPanel v-if="chart" data-testid="unjuran-chart">
        <DsChart
          type="line"
          title="Unjuran Kelas"
          :heading-level="2"
          :labels="chart.labels"
          :series="chart.series"
          unit="%"
        />
      </DsPanel>

      <DsDataTable
        :data="rows"
        :columns="columns"
        caption="Unjuran murid"
        card-title="name"
        :card-fields="CARD_FIELDS"
        :page-size="Math.max(1, rows.length)"
        pager="none"
        empty-title="Belum ada murid dalam kelas ini."
        data-testid="unjuran-table"
      />
    </template>
    <DsStack v-else-if="!error" gap="lg" aria-busy="true" data-testid="page-loading">
      <USkeleton class="h-24 w-full" />
      <USkeleton class="h-64 w-full" />
    </DsStack>
  </DsPage>
</template>
