<script setup lang="ts">
/**
 * "Engagement Mengikut Sekolah" (FN-M12-5.4.1; FR-M12-44; BR-M12-11/12): # · Sekolah (link + code line) ·
 * Pelajar · Aktif · Soalan · Sesi · Purata/Aktif · Skor · Tahap. Staff table (`DsDataTable`: card list below
 * md, inner scroll when wide).
 */
import { computed, ref } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import { RouterLink } from 'vue-router'

import { DsDataTable, DsPanel } from '@/ds'

import type { BandKey, BehaviorSchoolRow, WireId } from '../../../api/types'
import { BAND, count, mean, plain } from '../common/kirkpatrick-format'

const props = defineProps<{ rows: BehaviorSchoolRow[]; schoolPath: (id: WireId) => string }>()

/** Slot rows are untyped; this narrows the band key for the token lookups. */
const band = (key: unknown) => BAND[key as BandKey]

interface Row extends Record<string, unknown> {
  schoolId: WireId
  index: number
  name: string
  code: string
  students: string
  active: number
  activeText: string
  answers: string
  sessions: string
  perActive: string
  score: string
  tahap: BehaviorSchoolRow['tahap']
  tahapText: string
}

const data = computed<Row[]>(() =>
  props.rows.map((r, i) => ({
    schoolId: r.schoolId,
    index: i + 1,
    name: r.name,
    code: r.code ?? '-',
    students: count(r.students),
    active: r.active,
    activeText: plain(r.active),
    answers: count(r.answers),
    sessions: plain(r.sessions),
    perActive: mean(r.perActive),
    score: mean(r.score),
    tahap: r.tahap,
    tahapText: BAND[r.tahap].label,
  })),
)

const columns: TableColumn<Row>[] = [
  { accessorKey: 'index', header: '#' },
  { accessorKey: 'name', header: 'Sekolah' },
  { accessorKey: 'students', header: 'Pelajar' },
  { accessorKey: 'activeText', header: 'Aktif' },
  { accessorKey: 'answers', header: 'Soalan' },
  { accessorKey: 'sessions', header: 'Sesi' },
  { accessorKey: 'perActive', header: 'Purata/Aktif' },
  { accessorKey: 'score', header: 'Skor' },
  { accessorKey: 'tahapText', header: 'Tahap' },
]
/** Below md the card repeats every column of the table; `slotted` draws the cell slot (school link, colours, badge). */
const cardFields = [
  { key: 'name', label: 'Sekolah', slotted: true },
  { key: 'students', label: 'Pelajar', slotted: true },
  { key: 'activeText', label: 'Aktif', slotted: true },
  { key: 'answers', label: 'Soalan', slotted: true },
  { key: 'sessions', label: 'Sesi', slotted: true },
  { key: 'perActive', label: 'Purata/Aktif', slotted: true },
  { key: 'score', label: 'Skor', slotted: true },
  { key: 'tahapText', label: 'Tahap', slotted: true },
]

/** Paged at 20 rows. */
const PAGE_SIZES = [10, 20, 50]
const pageSize = ref(20)
</script>

<template>
  <DsPanel title="Engagement Mengikut Sekolah" icon="i-ph-buildings" data-testid="beh-schools">
    <DsDataTable
      v-model:page-size="pageSize"
      variant="bare"
      :page-size-options="PAGE_SIZES"
      :data="data"
      :columns="columns"
      caption="Engagement mengikut sekolah"
      card-title="index"
      :card-fields="cardFields"
    >
      <template #name-cell="{ row }">
        <span class="flex flex-col">
          <RouterLink
            :to="schoolPath(row.original.schoolId)"
            class="block max-w-72 whitespace-normal break-words text-label text-primary-t"
            data-testid="beh-school-link"
            >{{ row.original.name }}</RouterLink
          >
          <span class="text-body text-muted" data-testid="beh-school-code">{{
            row.original.code
          }}</span>
        </span>
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
      <template #answers-cell="{ row }">
        <span data-testid="cell-answers">{{ row.original.answers }}</span>
      </template>
      <template #sessions-cell="{ row }">
        <span data-testid="cell-sessions">{{ row.original.sessions }}</span>
      </template>
      <template #perActive-cell="{ row }">
        <span data-testid="cell-per-active">{{ row.original.perActive }}</span>
      </template>
      <template #score-cell="{ row }">
        <span :class="['text-label', band(row.original.tahap).text]" data-testid="cell-score">{{
          row.original.score
        }}</span>
      </template>
      <template #tahapText-cell="{ row }">
        <UBadge
          :color="band(row.original.tahap).color"
          variant="soft"
          :label="row.original.tahapText"
          data-testid="cell-tahap"
        />
      </template>
    </DsDataTable>
  </DsPanel>
</template>
