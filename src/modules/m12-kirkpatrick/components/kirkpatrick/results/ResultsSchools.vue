<script setup lang="ts">
/**
 * "Prestasi Mengikut Sekolah (Platform + Headcount)" (FN-M12-6.5.1; FR-M12-52; BR-M12-10): # · Sekolah · Pelajar · Aktif ·
 * Ketepatan · Soalan · Engagement · Tahap, by Engagement descending. A school with no active student is dimmed
 * (`data-faded`) with "-" for Ketepatan and Soalan; Engagement shows "-" unless the school has a session (940).
 * Staff table (`DsDataTable`).
 */
import { computed } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import { RouterLink } from 'vue-router'

import type { BandKey, ResultsSchoolRow } from '../../../api/types'
import KirkpatrickTableSection from '../common/KirkpatrickTableSection.vue'
import { BAND, count, mean, pct, plain } from '../common/kirkpatrick-format'
import KirkpatrickTable from '../common/KirkpatrickTable.vue'

const props = defineProps<{ rows: ResultsSchoolRow[]; schoolPath: (id: number) => string }>()

/** Slot rows are untyped; this narrows the band key for the token lookups. */
const band = (key: unknown) => BAND[key as BandKey]

interface Row extends Record<string, unknown> {
  schoolId: number
  index: number
  name: string
  faded: boolean
  students: string
  active: number
  activeText: string
  accuracy: number | null
  accuracyText: string
  answers: string
  engagement: string
  tahap: ResultsSchoolRow['tahap']
  tahapText: string
}

const data = computed<Row[]>(() =>
  props.rows.map((r, i) => ({
    schoolId: r.schoolId,
    index: i + 1,
    name: r.name,
    faded: r.faded,
    students: count(r.students),
    active: r.active,
    activeText: plain(r.active),
    accuracy: r.accuracy,
    accuracyText: r.accuracy === null ? '-' : pct(r.accuracy),
    answers: r.answers === null ? '-' : count(r.answers),
    engagement: r.engagement === null ? '-' : mean(r.engagement),
    tahap: r.tahap,
    tahapText: BAND[r.tahap].label,
  })),
)

const columns: TableColumn<Row>[] = [
  { accessorKey: 'index', header: '#' },
  { accessorKey: 'name', header: 'Sekolah' },
  { accessorKey: 'students', header: 'Pelajar' },
  { accessorKey: 'activeText', header: 'Aktif' },
  { accessorKey: 'accuracyText', header: 'Ketepatan' },
  { accessorKey: 'answers', header: 'Soalan' },
  { accessorKey: 'engagement', header: 'Engagement' },
  { accessorKey: 'tahapText', header: 'Tahap' },
]
const cardFields = [
  { key: 'students', label: 'Pelajar' },
  { key: 'activeText', label: 'Aktif' },
  { key: 'accuracyText', label: 'Ketepatan' },
  { key: 'answers', label: 'Soalan' },
  { key: 'engagement', label: 'Engagement' },
  { key: 'tahapText', label: 'Tahap' },
]
</script>

<template>
  <KirkpatrickTableSection
    title="Prestasi Mengikut Sekolah (Platform + Headcount)"
    icon="i-ph-buildings"
    data-testid="res-schools"
  >
    <KirkpatrickTable
      :data="data"
      :columns="columns"
      caption="Prestasi mengikut sekolah"
      card-title="name"
      :card-fields="cardFields"
    >
      <template #name-cell="{ row }">
        <RouterLink
          :to="schoolPath(row.original.schoolId)"
          :class="['line-clamp-2 max-w-72 text-label', row.original.faded ? 'text-dimmed' : 'text-primary']"
          :data-faded="row.original.faded ? 'true' : 'false'"
          data-testid="res-school-link"
          >{{ row.original.name }}</RouterLink
        >
      </template>
      <template #students-cell="{ row }">
        <span data-testid="cell-students">{{ row.original.students }}</span>
      </template>
      <template #activeText-cell="{ row }">
        <span
          :class="['text-label', row.original.active > 0 ? 'text-success' : 'text-dimmed']"
          data-testid="cell-active"
          >{{ row.original.activeText }}</span
        >
      </template>
      <template #accuracyText-cell="{ row }">
        <span
          :class="
            row.original.accuracy === null
              ? 'text-dimmed'
              : row.original.accuracy >= 60
                ? 'text-success'
                : 'text-warning'
          "
          data-testid="cell-accuracy"
          >{{ row.original.accuracyText }}</span
        >
      </template>
      <template #answers-cell="{ row }">
        <span data-testid="cell-answers">{{ row.original.answers }}</span>
      </template>
      <template #engagement-cell="{ row }">
        <span
          :class="['text-label', band(row.original.tahap).text]"
          data-testid="cell-engagement"
          >{{ row.original.engagement }}</span
        >
      </template>
      <template #tahapText-cell="{ row }">
        <UBadge
          :color="band(row.original.tahap).color"
          variant="soft"
          :label="row.original.tahapText"
          data-testid="cell-tahap"
        />
      </template>
    </KirkpatrickTable>
  </KirkpatrickTableSection>
</template>
