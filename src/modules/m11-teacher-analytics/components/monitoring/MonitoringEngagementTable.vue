<script setup lang="ts">
/**
 * The two S2 engagement tables (FN-M11-3.4.x student `#section-pelajar`, FN-M11-3.5.x teacher
 * `#section-guru`; FR-M11-37..42). Same columns, tahap colours, bar variants and legend; the teacher
 * table has "Login" instead of "Aktif" and one more legend entry. Empty rows render the headers and an
 * empty body (FR-M11-51). The table scrolls inside its card.
 */
import type { TableColumn } from '@nuxt/ui'
import { computed } from 'vue'

import { DsDrillTable } from '@/ds'

import type { SchoolEngagementRow, TahapKey, TeacherEngagementRow } from '../../api/types'
import { count, pct, TAHAP, type UiColor } from './monitoring-format'
import type { MonitoringPaths } from './monitoring-paths'

const props = defineProps<{
  kind: 'student' | 'teacher'
  rows: readonly (SchoolEngagementRow | TeacherEngagementRow)[]
  paths: MonitoringPaths
}>()

const tahapStyle = (t: TahapKey) => TAHAP[t]
const isStudent = computed(() => props.kind === 'student')
const sectionId = computed(() => (isStudent.value ? 'section-pelajar' : 'section-guru'))
const title = computed(() =>
  isStudent.value ? 'Analisis Penglibatan Pelajar T4/T5' : 'Analisis Penglibatan Guru',
)
const activeLabel = computed(() => (isStudent.value ? 'Aktif' : 'Login'))

type Row = (SchoolEngagementRow | TeacherEngagementRow) & Record<string, unknown>
const data = computed<Row[]>(() => props.rows.map((r) => ({ ...r })))
const active = (r: SchoolEngagementRow | TeacherEngagementRow) =>
  'engaged' in r ? r.engaged : r.loggedIn

const columns = computed<TableColumn<Row>[]>(() => [
  { id: 'no', header: '#', accessorFn: (r) => r.schoolId },
  { id: 'name', header: 'Sekolah', accessorKey: 'name' },
  { id: 'registered', header: 'Daftar', accessorKey: 'registered' },
  { id: 'active', header: activeLabel.value, accessorFn: (r) => active(r) },
  { id: 'pct', header: '%', accessorKey: 'pct' },
  { id: 'tahap', header: 'Tahap', accessorKey: 'tahap' },
  { id: 'bar', header: 'Bar', accessorFn: (r) => r.pct },
])

const LEGEND: readonly [UiColor, string][] = [
  ['success', 'Cemerlang (> 60%)'],
  ['warning', 'Sederhana (20-60%)'],
  ['error', 'Rendah (5-20%)'],
  ['error', 'Kritikal (< 5%)'],
  ['neutral', 'Tiada Langsung (0%)'],
]
</script>

<template>
  <UCard :id="sectionId" :data-testid="`mon-table-${kind}`">
    <div class="flex flex-col gap-4">
      <div class="flex flex-wrap items-start justify-between gap-2">
        <div class="flex min-w-0 flex-col gap-1">
          <h2 class="flex items-center gap-2 text-label text-highlighted">
            <UIcon
              :name="isStudent ? 'i-ph-chart-bar' : 'i-ph-chalkboard-teacher'"
              class="size-5 text-primary"
            />{{ title }}
          </h2>
          <p class="text-caption text-muted">
            Mengikut sekolah — disusun mengikut % penglibatan tertinggi
          </p>
        </div>
        <span class="tabular text-caption text-muted" data-testid="mon-table-count"
          >{{ count(rows.length) }} sekolah</span
        >
      </div>

      <div data-testid="mon-table-scroller">
        <DsDrillTable :data="data" :columns="columns" :caption="title">
          <template #no-cell="{ row }">
            <span class="tabular text-caption text-muted">{{ row.index + 1 }}</span>
          </template>
          <template #name-cell="{ row }">
            <div
              class="flex min-w-48 flex-col"
              data-testid="mon-table-row"
              :data-school-id="row.original.schoolId"
            >
              <RouterLink
                :to="paths.school(row.original.schoolId)"
                class="text-label text-primary"
                data-testid="mon-school-link"
                >{{ row.original.name }}</RouterLink
              >
              <span class="text-caption text-muted"
                >{{ row.original.code ?? '-' }} · {{ row.original.state }}</span
              >
            </div>
          </template>
          <template #registered-cell="{ row }">
            <span class="tabular">{{ count(row.original.registered) }}</span>
          </template>
          <template #active-cell="{ row }">
            <span class="tabular">{{ count(active(row.original)) }}</span>
          </template>
          <template #pct-cell="{ row }">
            <span :class="['tabular text-label', tahapStyle(row.original.tahap).text]">{{
              pct(row.original.pct)
            }}</span>
          </template>
          <template #tahap-cell="{ row }">
            <UBadge
              :color="tahapStyle(row.original.tahap).color"
              variant="subtle"
              class="whitespace-nowrap"
              :label="row.original.tahap"
            />
          </template>
          <template #bar-cell="{ row }">
            <span
              v-if="tahapStyle(row.original.tahap).bar === 'empty'"
              class="text-caption text-muted"
              >0%</span
            >
            <UProgress
              v-else
              class="min-w-32"
              :model-value="Math.max(row.original.pct, 3)"
              :color="tahapStyle(row.original.tahap).color"
              size="md"
            />
          </template>
        </DsDrillTable>
      </div>

      <p
        class="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-muted"
        data-testid="mon-legend"
      >
        <span class="text-label text-default">Legenda:</span>
        <UBadge
          v-for="[color, label] in LEGEND"
          :key="label"
          :color="color"
          variant="subtle"
          icon="i-ph-circle-fill"
          :label="label"
        />
        <UBadge
          v-if="!isStudent"
          color="neutral"
          variant="subtle"
          icon="i-ph-circle"
          label="Tiada Guru (0 daftar)"
        />
      </p>
    </div>
  </UCard>
</template>
