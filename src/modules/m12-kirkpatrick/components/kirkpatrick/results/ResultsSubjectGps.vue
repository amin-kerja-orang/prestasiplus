<script setup lang="ts">
/**
 * "GPS Mengikut Subjek ({tahun})" (FN-M12-6.3.1; FR-M12-50; BR-M12-19): # · Subjek · GPS · Gred · Calon · Trend, by GPS
 * ascending. The subject cell is plain text with no action (DV-M12-05). The same platform
 * rows show in every scope (DV-M12-26). Staff table (`DsDataTable`).
 */
import { computed } from 'vue'
import type { TableColumn } from '@nuxt/ui'

import { DsDataTable } from '@/ds'

import KirkpatrickTableSection from '../common/KirkpatrickTableSection.vue'
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
</script>

<template>
  <KirkpatrickTableSection
    :title="`GPS Mengikut Subjek (${subjectGps.year})`"
    icon="i-ph-book"
    footnote="GPS rendah = lebih baik. Trend: berbanding tahun sebelumnya."
    data-testid="res-subject-gps"
  >
    <DsDataTable
      :data="rows"
      :columns="columns"
      caption="GPS mengikut subjek"
      card-title="name"
      :card-fields="cardFields"
      :page-size="1000"
    >
      <template #name-cell="{ row }">
        <span class="text-label text-highlighted" data-testid="cell-subject">{{
          row.original.name
        }}</span>
      </template>
      <template #gpsText-cell="{ row }">
        <span class="text-label text-highlighted" data-testid="cell-gps">{{
          row.original.gpsText
        }}</span>
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
              'inline-flex items-center gap-1 text-caption',
              row.original.worse ? 'text-error' : 'text-success',
            ]"
          >
            <UIcon :name="row.original.worse ? 'i-ph-arrow-down' : 'i-ph-arrow-up'" class="size-4" />
            <span class="text-muted">{{ row.original.trendText }}</span>
          </span>
        </span>
      </template>
    </DsDataTable>
  </KirkpatrickTableSection>
</template>
