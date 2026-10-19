<script setup lang="ts">
/**
 * S4 `/pksk/level/:level/history` "Sejarah PKSK - {L}" (M07-T2; FR-M07-14, FR-M07-15; DV-M07-01,
 * PROPOSED COPY, L-4: live answers HTTP 500). Read-only list of the user's completed full exams,
 * newest first. Provisional page. The Tarikh / Skor / Gred table is a semantic table inside one
 * card (no row lines) so the columns stay readable at 375px.
 */
import { computed, watch } from 'vue'

import { usePageMeta } from '@/composables'
import { DsDataTable, DsEmptyState, DsLoadError, DsPage } from '@/ds'
import { formatDate } from '@/lib/time'

import { fetchPkskExamAttempts } from '../api/pksk'
import type { PkskLevel } from '../api/types'
import { LOAD_ERROR, isLoadError, usePkskData } from '../lib/load'

const props = defineProps<{ level: PkskLevel }>()

const pageMeta = usePageMeta()
watch(
  () => props.level,
  (level) => {
    pageMeta.setHeader({ title: `Sejarah PKSK - ${level}`, subtitle: 'Lihat prestasi lepas' })
  },
  { immediate: true },
)

const { data, error, reload } = usePkskData(
  (signal) => fetchPkskExamAttempts(props.level, { signal }),
  [() => props.level],
)
const cardFields = [
  { key: 'score', label: 'Skor' },
  { key: 'grade', label: 'Gred' },
]
const columns = [
  { accessorKey: 'date', header: 'Tarikh' },
  { accessorKey: 'score', header: 'Skor' },
  { accessorKey: 'grade', header: 'Gred' },
]
const rows = computed(() =>
  (data.value ?? []).map((a) => ({
    date: formatDate(a.completedAt),
    score: `${String(Math.round(a.scorePct))}%`,
    grade: a.grade,
  })),
)
const loadFailed = computed(() => isLoadError(error.value))
</script>

<template>
  <DsPage
    :back-to="`/pksk/level/${level}`"
    back-label="Kembali ke Dashboard"
    data-testid="pksk-history"
    data-provisional="L-4"
  >
    <DsLoadError v-if="loadFailed" :message="LOAD_ERROR" testid="page-error" @retry="reload()" />

    <template v-else-if="data">
      <UCard v-if="data.length === 0" data-testid="history-empty">
        <DsEmptyState item="sejarah peperiksaan" icon="i-ph-clock-counter-clockwise-duotone" />
      </UCard>
      <DsDataTable
        v-else
        :data="rows"
        :columns="columns"
        caption="Sejarah peperiksaan PKSK"
        card-title="date"
        :card-fields="cardFields"
        data-testid="history-table"
      />
    </template>
  </DsPage>
</template>
