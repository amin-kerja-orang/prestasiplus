<script setup lang="ts">
/**
 * S1 "📚 GPS Mengikut Subjek" (FR-M08-18): rows by GPS ascending, rows without data ("—", 0 …) last.
 * Staff table (`DsDataTable`: card list below md, inner scroll when wide).
 */
import { computed } from 'vue'
import type { TableColumn } from '@nuxt/ui'

import { DsDataTable } from '@/ds'

import type { SchoolPerformance } from '../../api/types'
import { ACHIEVEMENT_COLOR, BAND_STYLE, DASH, bandOf, dec2 } from '../../lib/prestasi/format'

const props = defineProps<{ subjects: SchoolPerformance['subjects'] }>()

const bandText = (gps: number | null): string =>
  gps === null ? 'text-dimmed' : BAND_STYLE[bandOf(gps)].text

type Subject = SchoolPerformance['subjects'][number]
interface Row extends Record<string, unknown> {
  subjectId: number
  index: number
  name: string
  gpsText: string
  gradeText: string
  entries: number
  onTrack: number
  below: number
  noTarget: number
  gps: number | null
  achievementPct: number | null
}

const sorted = computed<Subject[]>(() =>
  [...props.subjects].sort((a, b) => {
    if (a.gps === null && b.gps === null) return 0
    if (a.gps === null) return 1
    if (b.gps === null) return -1
    return a.gps - b.gps
  }),
)
const rows = computed<Row[]>(() =>
  sorted.value.map((s, i) => ({
    subjectId: s.subjectId,
    index: i + 1,
    name: s.name,
    gpsText: s.gps === null ? DASH : dec2(s.gps),
    gradeText: s.grade ?? DASH,
    entries: s.entries,
    onTrack: s.onTrack,
    below: s.below,
    noTarget: s.noTarget,
    gps: s.gps,
    achievementPct: s.achievementPct,
  })),
)

const columns: TableColumn<Row>[] = [
  { accessorKey: 'index', header: '#' },
  { accessorKey: 'name', header: 'Subjek' },
  { accessorKey: 'gpsText', header: 'GPS' },
  { accessorKey: 'gradeText', header: 'Gred' },
  { accessorKey: 'entries', header: 'Entri' },
  { accessorKey: 'onTrack', header: 'Atas Landasan' },
  { accessorKey: 'below', header: 'Below' },
  { accessorKey: 'noTarget', header: 'Tiada Sasaran' },
  { accessorKey: 'achievementPct', header: 'Pencapaian' },
]
const cardFields = [
  { key: 'gpsText', label: 'GPS' },
  { key: 'gradeText', label: 'Gred' },
  { key: 'entries', label: 'Entri' },
  { key: 'onTrack', label: 'Atas Landasan' },
  { key: 'below', label: 'Below' },
  { key: 'noTarget', label: 'Tiada Sasaran' },
]
</script>

<template>
  <section class="flex min-w-0 flex-col gap-3" data-testid="subject-card">
    <h2 class="text-subheading text-highlighted">📚 GPS Mengikut Subjek</h2>
    <DsDataTable
      :data="rows"
      :columns="columns"
      caption="GPS mengikut subjek"
      card-title="name"
      :card-fields="cardFields"
      :page-size="100"
      data-testid="subject-table"
    >
      <template #name-cell="{ row }">
        <span
          class="text-label whitespace-nowrap text-highlighted"
          :data-testid="`subject-row-${row.original.subjectId}`"
          >{{ row.original.name }}</span
        >
      </template>
      <template #gpsText-cell="{ row }">
        <span :class="[bandText(row.original.gps), 'text-label']">{{
          row.original.gpsText
        }}</span>
      </template>
      <template #gradeText-cell="{ row }">
        <span :class="[bandText(row.original.gps), 'text-label']">{{
          row.original.gradeText
        }}</span>
      </template>
      <template #onTrack-cell="{ row }">
        <span class="text-success">{{ row.original.onTrack }}</span>
      </template>
      <template #below-cell="{ row }">
        <span class="text-error">{{ row.original.below }}</span>
      </template>
      <template #noTarget-cell="{ row }">
        <span class="text-warning">{{ row.original.noTarget }}</span>
      </template>
      <template #achievementPct-cell="{ row }">
        <UProgress
          v-if="row.original.gps !== null && row.original.achievementPct !== null"
          :model-value="row.original.achievementPct"
          :max="100"
          :color="ACHIEVEMENT_COLOR[bandOf(row.original.gps)]"
          size="sm"
          class="min-w-32"
          :aria-label="`Pencapaian ${row.original.name}`"
        />
      </template>
    </DsDataTable>
  </section>
</template>
