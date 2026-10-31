<script setup lang="ts">
/**
 * The two S2 engagement tables (FN-M11-3.4.x student `#section-pelajar`, FN-M11-3.5.x teacher
 * `#section-guru`; FR-M11-37..42). Same columns, tahap colours, bar variants and legend; the teacher
 * table has "Login" instead of "Aktif" and one more legend entry. Empty rows render the headers and an
 * empty body (FR-M11-51). Paged at 20 rows; cards below md.
 */
import type { TableColumn } from '@nuxt/ui'
import { computed, ref } from 'vue'

import { DsBadge, DsDataTable, DsPanel, DsProgress } from '@/ds'

import type { SchoolEngagementRow, TahapKey, TeacherEngagementRow } from '../../api/types'
import { count, pct, TAHAP, type UiColor } from './monitoring-format'
import type { MonitoringPaths } from './monitoring-paths'

const props = defineProps<{
  kind: 'student' | 'teacher'
  rows: readonly (SchoolEngagementRow | TeacherEngagementRow)[]
  paths: MonitoringPaths
}>()

/** Paged at 20 rows (FN-M11-3.4.x). */
const pageSize = ref(20)
const PAGE_SIZES = [10, 20, 50]

const tahapStyle = (t: TahapKey) => TAHAP[t]
/** DsProgress has no neutral tone; the empty bar is not drawn, so the fallback is never seen. */
const barTone = (t: TahapKey) => {
  const c = TAHAP[t].color
  return c === 'success' || c === 'warning' || c === 'error' ? c : 'primary'
}
const isStudent = computed(() => props.kind === 'student')
const sectionId = computed(() => (isStudent.value ? 'section-pelajar' : 'section-guru'))
const title = computed(() =>
  isStudent.value ? 'Analisis Penglibatan Pelajar T4/T5' : 'Analisis Penglibatan Guru',
)
const activeLabel = computed(() => (isStudent.value ? 'Aktif' : 'Login'))

type Row = (SchoolEngagementRow | TeacherEngagementRow) & { rank: number } & Record<string, unknown>
const data = computed<Row[]>(() => props.rows.map((r, i) => ({ ...r, rank: i + 1 })))
const active = (r: SchoolEngagementRow | TeacherEngagementRow) =>
  'engaged' in r ? r.engaged : r.loggedIn

const columns = computed<TableColumn<Row>[]>(() => [
  { id: 'no', header: '#', accessorKey: 'rank' },
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
  <section :id="sectionId" class="flex flex-col gap-6" :data-testid="`mon-table-${kind}`">
    <DsPanel
      :title="title"
      description="Mengikut sekolah — disusun mengikut % penglibatan tertinggi"
      :icon="isStudent ? 'chart-bar' : 'chalkboard-teacher'"
      accent="action"
    >
      <template #actions>
        <DsBadge
          tone="neutral"
          class="tabular"
          data-testid="mon-table-count"
          :label="`${count(rows.length)} sekolah`"
        />
      </template>
      <DsDataTable
        v-model:page-size="pageSize"
        variant="bare"
        :page-size-options="PAGE_SIZES"
        :data="data"
        :columns="columns"
        :caption="title"
        empty-title="Tiada data"
      >
        <template #no-cell="{ row }">
          <span class="tabular text-body text-muted">{{ row.original.rank }}</span>
        </template>
        <template #name-cell="{ row }">
          <div
            class="flex max-w-72 min-w-40 flex-col gap-1 whitespace-normal"
            data-testid="mon-table-row"
            :data-school-id="row.original.schoolId"
          >
            <RouterLink
              :to="paths.school(row.original.schoolId)"
              class="line-clamp-2 text-label text-primary-t"
              data-testid="mon-school-link"
              >{{ row.original.name }}</RouterLink
            >
            <span class="text-body text-muted"
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
          <DsBadge :tone="tahapStyle(row.original.tahap).color" :label="row.original.tahap" />
        </template>
        <template #bar-cell="{ row }">
          <span v-if="tahapStyle(row.original.tahap).bar === 'empty'" class="text-body text-muted"
            >0%</span
          >
          <DsProgress
            v-else
            :value="Math.max(row.original.pct, 3)"
            :tone="barTone(row.original.tahap)"
            :show-value="false"
            :aria-label="pct(row.original.pct)"
          />
        </template>
        <template #card="{ row }">
          <div class="flex flex-col gap-3">
            <div class="flex items-start justify-between gap-3">
              <div class="flex min-w-0 flex-col gap-1">
                <RouterLink
                  :to="paths.school((row as Row).schoolId)"
                  class="line-clamp-2 text-label text-primary-t"
                  data-testid="mon-school-link"
                  >{{ (row as Row).name }}</RouterLink
                >
                <span class="text-body text-muted"
                  >{{ (row as Row).code ?? '-' }} · {{ (row as Row).state }}</span
                >
              </div>
              <DsBadge :tone="tahapStyle((row as Row).tahap).color" :label="(row as Row).tahap" />
            </div>
            <dl class="grid grid-cols-3 gap-3 text-body">
              <div>
                <dt class="text-muted">Daftar</dt>
                <dd class="tabular text-label">{{ count((row as Row).registered) }}</dd>
              </div>
              <div>
                <dt class="text-muted">{{ activeLabel }}</dt>
                <dd class="tabular text-label">{{ count(active(row as Row)) }}</dd>
              </div>
              <div>
                <dt class="text-muted">%</dt>
                <dd :class="['tabular text-label', tahapStyle((row as Row).tahap).text]">
                  {{ pct((row as Row).pct) }}
                </dd>
              </div>
            </dl>
            <DsProgress
              v-if="tahapStyle((row as Row).tahap).bar !== 'empty'"
              :value="Math.max((row as Row).pct, 3)"
              :tone="barTone((row as Row).tahap)"
              :show-value="false"
              :aria-label="pct((row as Row).pct)"
            />
          </div>
        </template>
      </DsDataTable>
    </DsPanel>

    <DsPanel data-testid="mon-legend"
      ><details>
        <summary class="cursor-pointer text-label text-highlighted">Legenda</summary>
        <p class="mt-4 flex flex-wrap items-center gap-2 text-body text-muted">
          <DsBadge
            v-for="[color, label] in LEGEND"
            :key="label"
            :tone="color"
           
            :label="label"
          />
          <DsBadge v-if="!isStudent" tone="neutral" label="Tiada Guru (0 daftar)" />
        </p></details
    ></DsPanel>
  </section>
</template>
