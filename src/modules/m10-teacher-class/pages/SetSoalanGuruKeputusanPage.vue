<script setup lang="ts">
/**
 * R1-GUR-8b `/guru/set-soalan/:id/keputusan` "Keputusan: {tajuk}" (S6-T14; API-GUR-16 results): the select
 * "Kelas" ("Semua Kelas", then the classes ticked on the set), the tiles Penyertaan / Skor Purata /
 * Jumlah Percubaan, and the table # · Pelajar · Skor "{betul}/{jumlah}" · Ketepatan · Tarikh (newest
 * first, 25 per page by the server). Ketepatan is shown as a whole number rounded half up: at least 70
 * green, at least 50 amber, else red. Empty: "Belum ada pelajar menjawab set ini.".
 */
import { GURU_SET_MESSAGES, GURU_SET_RESULTS_PAGE_SIZE } from '@pp/contract'
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'

import { useApi } from '@/composables'
import {
  DsBackLink,
  DsDataTable,
  DsEmptyState,
  DsFormField,
  DsLoadError,
  DsNativeSelect,
  DsPage,
  DsPanel,
  DsStack,
  DsStatRow,
} from '@/ds'
import { formatDate } from '@/lib/time'

import { fetchGuruClasses, fetchGuruSet, fetchGuruSetResults } from '../api/guru'

const COPY = {
  back: 'Kembali ke Set Soalan',
  title: 'Keputusan',
  classLabel: 'Kelas',
  allClasses: 'Semua Kelas',
  participation: 'Penyertaan',
  average: 'Skor Purata',
  attempts: 'Jumlah Percubaan',
  colNo: '#',
  colPupil: 'Pelajar',
  colScore: 'Skor',
  colAccuracy: 'Ketepatan',
  colDate: 'Tarikh',
  loadFailed: 'Gagal memuatkan keputusan. Sila cuba lagi.',
  retry: 'Cuba Lagi',
} as const

const route = useRoute()
const setId = computed(() => String(route.params.id ?? ''))

const { data: set, error: setError, reload: reloadSet } = useApi((signal) => fetchGuruSet(setId.value, { signal }))
const { data: classList } = useApi((signal) => fetchGuruClasses({ signal }))
/** "Kelas" options: the classes ticked on the set, named from the own class list. */
const options = computed(() => {
  const ids = new Set(set.value?.classroomIds ?? [])
  return (classList.value?.data ?? [])
    .filter((c) => ids.has(String(c.id)))
    .map((c) => ({ id: String(c.id), name: c.name }))
})

const pageTitle = computed(() => (set.value ? `${COPY.title}: ${set.value.title}` : COPY.title))
const classroomId = ref('')
const page = ref(1)

const { data, error, loading, reload } = useApi(
  (signal) =>
    fetchGuruSetResults(
      setId.value,
      {
        ...(classroomId.value ? { classroomId: classroomId.value } : {}),
        page: page.value,
      },
      { signal },
    ),
  [classroomId, page],
)

function onClassChange(value: string): void {
  classroomId.value = value
  page.value = 1
}

const stats = computed(() => {
  const s = data.value?.summary
  return [
    {
      key: 'penyertaan',
      label: COPY.participation,
      value: s?.penyertaan ?? 0,
      icon: 'users',
    },
    {
      key: 'skor',
      label: COPY.average,
      value: s?.skorPurata === null || s === undefined ? null : `${String(s.skorPurata)}%`,
      icon: 'chart-line-up',
    },
    {
      key: 'percubaan',
      label: COPY.attempts,
      value: s?.jumlahPercubaan ?? 0,
      icon: 'list-checks',
    },
  ]
})

/** Whole number, rounded half up. */
const whole = (n: number): number => Math.floor(n + 0.5)
const accuracyColor = (n: number): 'success' | 'warning' | 'error' =>
  n >= 70 ? 'success' : n >= 50 ? 'warning' : 'error'

interface Row extends Record<string, unknown> {
  no: number
  pupil: string
  score: string
  accuracy: number
  date: string
}
const rows = computed<Row[]>(() =>
  (data.value?.rows ?? []).map((r, i) => ({
    no: (page.value - 1) * GURU_SET_RESULTS_PAGE_SIZE + i + 1,
    pupil: r.pupil.name,
    score: `${String(r.correct)}/${String(r.total)}`,
    accuracy: whole(r.accuracy),
    date: formatDate(r.attemptedAt),
  })),
)
const columns = [
  { accessorKey: 'no', header: COPY.colNo },
  { accessorKey: 'pupil', header: COPY.colPupil },
  { accessorKey: 'score', header: COPY.colScore },
  { accessorKey: 'accuracy', header: COPY.colAccuracy },
  { accessorKey: 'date', header: COPY.colDate },
]
const cardFields = [
  { key: 'score', label: COPY.colScore },
  { key: 'accuracy', label: COPY.colAccuracy },
  { key: 'date', label: COPY.colDate },
]
</script>

<template>
  <DsPage :title="pageTitle" title-testid="set-results-title" data-testid="set-results-page">
    <DsBackLink to="/guru/set-soalan" :label="COPY.back" data-testid="set-results-back" />

    <DsLoadError
      v-if="setError"
      :message="COPY.loadFailed"
      :retry-label="COPY.retry"
      testid="set-results-set-error"
      @retry="reloadSet"
    />
    <DsStack v-else gap="md">
      <DsFormField :label="COPY.classLabel" name="set-results-class">
        <DsNativeSelect
          id="set-results-class"
          :model-value="classroomId"
          data-testid="set-results-class"
          @update:model-value="onClassChange(String($event))"
        >
          <option value="">{{ COPY.allClasses }}</option>
          <option v-for="c in options" :key="c.id" :value="c.id">{{ c.name }}</option>
        </DsNativeSelect>
      </DsFormField>

      <DsLoadError
        v-if="error"
        :message="COPY.loadFailed"
        :retry-label="COPY.retry"
        testid="set-results-error"
        @retry="reload"
      />
      <template v-else>
        <DsStatRow
          :items="stats"
          prefix="set-results-stat"
          :cols="3"
          :loading="!data"
          data-testid="set-results-stats"
        />

        <USkeleton v-if="!data" class="h-40 w-full" aria-busy="true" data-testid="set-results-loading" />
        <DsPanel v-else-if="rows.length === 0 && page === 1" data-testid="set-results-empty">
          <DsEmptyState :title="GURU_SET_MESSAGES.emptyResults" icon="chart-bar" />
        </DsPanel>
        <DsDataTable
          v-else
          v-model:page="page"
          :data="rows"
          :columns="columns"
          :caption="pageTitle"
          :page-size="GURU_SET_RESULTS_PAGE_SIZE"
          :total="data.totalItems"
          :loading="loading"
          card-title="pupil"
          :card-fields="cardFields"
          data-testid="set-results-table"
        >
          <template #pupil-cell="{ row }">
            <span data-testid="result-pupil">{{ row.original.pupil }}</span>
          </template>
          <template #accuracy-cell="{ row }">
            <UBadge
              :color="accuracyColor(row.original.accuracy)"
              variant="subtle"
              :data-color="accuracyColor(row.original.accuracy)"
              data-testid="result-accuracy"
              >{{ row.original.accuracy }}%</UBadge
            >
          </template>
        </DsDataTable>
      </template>
    </DsStack>
  </DsPage>
</template>
