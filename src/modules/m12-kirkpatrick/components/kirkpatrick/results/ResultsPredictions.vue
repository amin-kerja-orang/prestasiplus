<script setup lang="ts">
/**
 * "Ramalan Prestasi Pelajar Aktif" (FN-M12-6.6.1; FR-M12-53; BR-M12-21; NFR-M12-01): every active student (946 rows).
 * Staff table (`DsDataTable`); D9 deviation: 50 rows a page instead of one 946-row page, which is too heavy for a
 * flat staff table. The two link columns are router links.
 */
import { computed } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import { RouterLink } from 'vue-router'

import type { SpmGrade } from '../../../api/types'
import KirkpatrickTableSection from '../common/KirkpatrickTableSection.vue'
import { count, pct } from '../common/kirkpatrick-format'
import { COLOR_TEXT, GRADE_PILL } from './results-format'
import type { ResultsPrediction } from './results-types'
import KirkpatrickTable from '../common/KirkpatrickTable.vue'

const props = defineProps<{
  rows: ResultsPrediction[]
  schoolPath: (id: number) => string
}>()

/** Slot rows are untyped; this narrows the grade for the badge colour. */
const gradeColor = (grade: unknown) => GRADE_PILL[grade as SpmGrade]

interface Row extends Record<string, unknown> {
  userId: number
  index: number
  name: string
  schoolId: number
  schoolName: string
  answers: string
  accuracy: string
  grade: ResultsPrediction['grade']
}

const data = computed<Row[]>(() =>
  props.rows.map((r, i) => ({
    userId: r.userId,
    index: i + 1,
    name: r.name,
    schoolId: r.schoolId,
    schoolName: r.schoolName,
    answers: count(r.answers),
    accuracy: pct(r.accuracy),
    grade: r.grade,
  })),
)

const columns: TableColumn<Row>[] = [
  { accessorKey: 'index', header: '#' },
  { accessorKey: 'name', header: 'Pelajar' },
  { accessorKey: 'schoolName', header: 'Sekolah' },
  { accessorKey: 'answers', header: 'Soalan' },
  { accessorKey: 'accuracy', header: 'Ketepatan' },
  { accessorKey: 'grade', header: 'Anggaran Gred' },
]
const cardFields = [
  { key: 'schoolName', label: 'Sekolah' },
  { key: 'answers', label: 'Soalan' },
  { key: 'accuracy', label: 'Ketepatan' },
  { key: 'grade', label: 'Anggaran Gred' },
]
</script>

<template>
  <KirkpatrickTableSection
    title="Ramalan Prestasi Pelajar Aktif"
    subtitle="Berdasarkan ketepatan menjawab soalan dalam platform"
    icon="i-ph-magic-wand"
    footnote="Ramalan ini berdasarkan ketepatan menjawab soalan dalam platform sahaja. Ramalan penuh memerlukan lebih banyak data termasuk keputusan peperiksaan terdahulu."
    data-testid="res-predictions"
  >
    <KirkpatrickTable
      :data="data"
      :columns="columns"
      caption="Ramalan prestasi pelajar aktif"
      card-title="name"
      :card-fields="cardFields"
      :page-size="50"
    >
      <template #name-cell="{ row }">
        <span data-testid="res-pred-row">
          <RouterLink
            :to="`${schoolPath(row.original.schoolId)}/pelajar/${row.original.userId}`"
            class="text-label text-primary"
            data-testid="pred-student"
            >{{ row.original.name }}</RouterLink
          >
        </span>
      </template>
      <template #schoolName-cell="{ row }">
        <RouterLink
          :to="schoolPath(row.original.schoolId)"
          class="text-primary"
          data-testid="pred-school"
          >{{ row.original.schoolName }}</RouterLink
        >
      </template>
      <template #accuracy-cell="{ row }">
        <span
          :class="['text-label', COLOR_TEXT[gradeColor(row.original.grade)]]"
          data-testid="pred-accuracy"
          >{{ row.original.accuracy }}</span
        >
      </template>
      <template #grade-cell="{ row }">
        <UBadge
          :color="gradeColor(row.original.grade)"
          variant="soft"
          :label="row.original.grade"
          data-testid="pred-grade"
        />
      </template>
    </KirkpatrickTable>
  </KirkpatrickTableSection>
</template>
