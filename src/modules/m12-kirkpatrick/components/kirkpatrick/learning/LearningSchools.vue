<script setup lang="ts">
/**
 * S3 "Pembelajaran Mengikut Sekolah" (FN-M12-4.4.1; FR-M12-39, BR-M12-10): # / Sekolah (link to the monitoring
 * school page of the mount) / Pelajar / Soalan / Ketepatan / Skor Purata / Subjek. Staff table (`DsDataTable`:
 * card list below md, inner scroll when wide, NFR-RESP-05 b).
 */
import { computed } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import { RouterLink } from 'vue-router'

import type { Learning } from '../../../api/types'
import {
  accuracyText,
  count,
  KirkpatrickTableSection,
  pct,
  plain,
  type KirkpatrickPaths,
} from '../common'
import KirkpatrickTable from '../common/KirkpatrickTable.vue'

const props = defineProps<{ schools: Learning['schools']; paths: KirkpatrickPaths }>()

type School = Learning['schools'][number]
interface Row extends Record<string, unknown> {
  schoolId: number
  index: number
  name: string
  students: string
  answers: string
  accuracy: number
  accuracyText: string
  avgScore: string
  subjects: string
}

const rows = computed<Row[]>(() =>
  props.schools.map((s: School, i) => ({
    schoolId: s.schoolId,
    index: i + 1,
    name: s.name,
    students: count(s.students),
    answers: count(s.answers),
    accuracy: s.accuracy,
    accuracyText: pct(s.accuracy),
    avgScore: pct(s.avgScore),
    subjects: plain(s.subjects),
  })),
)

const columns: TableColumn<Row>[] = [
  { accessorKey: 'index', header: '#' },
  { accessorKey: 'name', header: 'Sekolah' },
  { accessorKey: 'students', header: 'Pelajar' },
  { accessorKey: 'answers', header: 'Soalan' },
  { accessorKey: 'accuracyText', header: 'Ketepatan' },
  { accessorKey: 'avgScore', header: 'Skor Purata' },
  { accessorKey: 'subjects', header: 'Subjek' },
]
const cardFields = [
  { key: 'students', label: 'Pelajar' },
  { key: 'answers', label: 'Soalan' },
  { key: 'accuracyText', label: 'Ketepatan' },
  { key: 'avgScore', label: 'Skor Purata' },
  { key: 'subjects', label: 'Subjek' },
]
</script>

<template>
  <KirkpatrickTableSection
    title="Pembelajaran Mengikut Sekolah"
    icon="i-ph-buildings"
    data-testid="kirk-schools"
  >
    <KirkpatrickTable
      :data="rows"
      :columns="columns"
      caption="Pembelajaran mengikut sekolah"
      card-title="name"
      :card-fields="cardFields"
      data-testid="kirk-schools-scroller"
    >
      <template #name-cell="{ row }">
        <RouterLink
          :to="paths.monitoringSchool(row.original.schoolId)"
          class="line-clamp-2 max-w-72 text-label text-primary"
          data-testid="kirk-school-link"
          >{{ row.original.name }}</RouterLink
        >
      </template>
      <template #accuracyText-cell="{ row }">
        <span
          :class="['text-label', accuracyText(row.original.accuracy)]"
          data-testid="kirk-school-accuracy"
          >{{ row.original.accuracyText }}</span
        >
      </template>
    </KirkpatrickTable>
  </KirkpatrickTableSection>
</template>
