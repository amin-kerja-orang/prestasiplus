<script setup lang="ts">
/**
 * "GPS Mengikut Subjek ({tahun})" (FN-M12-6.3.1; FR-M12-50; BR-M12-19): # · Subjek · GPS · Gred · Calon · Trend, by GPS
 * ascending. The subject cell is plain text with no action (DV-M12-05). The same platform
 * rows show in every scope (DV-M12-26). Staff table (`DsDataTable`).
 */
import { computed, ref } from 'vue'
import type { TableColumn } from '@nuxt/ui'

import { DsDataTable, DsPanel, DsText } from '@/ds'

import { gps } from '../common/kirkpatrick-format'
import type { ResultsSubjectGps } from './results-types'

const props = defineProps<{ subjectGps: ResultsSubjectGps }>()

interface Row extends Record<string, unknown> {
  name: string
  index: number
  gpsText: string
  grade: string
  candidates: number
  trendText: string
  worse: boolean
  prev: number | null
}

const rows = computed<Row[]>(() =>
  [...props.subjectGps.rows]
    .sort((a, b) => a.gps - b.gps)
    .map((r, i) => ({
      name: r.name,
      index: i + 1,
      gpsText: gps(r.gps),
      grade: r.grade,
      candidates: r.candidates,
      trendText: r.prev === null ? '' : gps(r.prev),
      worse: r.prev !== null && r.gps > r.prev,
      prev: r.prev,
    })),
)

const columns: TableColumn<Row>[] = [
  { accessorKey: 'index', header: '#' },
  { accessorKey: 'name', header: 'Subjek' },
  { accessorKey: 'gpsText', header: 'GPS' },
  { accessorKey: 'grade', header: 'Gred' },
  { accessorKey: 'candidates', header: 'Calon' },
  { accessorKey: 'trendText', header: 'Trend' },
]
const cardFields = [
  { key: 'gpsText', label: 'GPS' },
  { key: 'grade', label: 'Gred' },
  { key: 'candidates', label: 'Calon' },
  { key: 'trendText', label: 'Trend' },
]

/** Paged at 20 rows. */
const PAGE_SIZES = [10, 20, 50]
const pageSize = ref(20)
</script>

<template>
  <DsPanel
    :title="`GPS Mengikut Subjek (${subjectGps.year})`"
    icon="i-ph-book"
    data-testid="res-subject-gps"
  >
    <DsDataTable
      v-model:page-size="pageSize"
      variant="bare"
      :page-size-options="PAGE_SIZES"
      :data="rows"
      :columns="columns"
      caption="GPS mengikut subjek"
      card-title="name"
      :card-fields="cardFields"
    >
      <template #name-cell="{ row }">
        <DsText variant="label" tone="highlighted" data-testid="cell-subject">{{
          row.original.name
        }}</DsText>
      </template>
      <template #gpsText-cell="{ row }">
        <DsText variant="label" tone="highlighted" data-testid="cell-gps">{{
          row.original.gpsText
        }}</DsText>
      </template>
      <template #grade-cell="{ row }">
        <span class="text-label" data-testid="cell-grade">{{ row.original.grade }}</span>
      </template>
      <template #candidates-cell="{ row }">
        <span data-testid="cell-candidates">{{ row.original.candidates }}</span>
      </template>
      <template #trendText-cell="{ row }">
        <span data-testid="cell-trend">
          <span
            v-if="row.original.prev !== null"
            :class="[
              'inline-flex items-center gap-1 text-body',
              row.original.worse ? 'text-error' : 'text-success',
            ]"
          >
            <UIcon
              :name="row.original.worse ? 'i-ph-arrow-down' : 'i-ph-arrow-up'"
              class="size-4"
            />
            <span class="text-muted">{{ row.original.trendText }}</span>
          </span>
        </span>
      </template>
    </DsDataTable>
    <p class="flex items-start gap-2 px-1 pt-3 text-caption text-muted">
      <UIcon name="i-ph-info" class="mt-1 size-4 shrink-0" />GPS rendah = lebih baik. Trend:
      berbanding tahun sebelumnya.
    </p>
  </DsPanel>
</template>
