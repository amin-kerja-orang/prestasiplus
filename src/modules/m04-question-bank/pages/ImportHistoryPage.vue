<script setup lang="ts">
/**
 * S5h `/admin/questions/import-history` "Sejarah Import" (M04-T5; FR-M04-58, DV-M04-01, PROPOSED COPY).
 *
 * Read-only: the link "Kembali" (→ S5) and the table of import runs, newest first, 20 per page with the
 * shared Laravel pager ("Tarikh" `dd/mm/yyyy HH:mm`, "Fail", "Diimport", "Gagal"), or "Tiada sejarah
 * import.". The table scrolls inside its card below `md`. A load failure shows the red alert with
 * "Cuba Semula" (SRS §8.2).
 */
import type { TableColumn } from '@nuxt/ui'
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useApi } from '@/composables'
import { DsDataTable, DsPage, type CardField } from '@/ds'
import { formatDateTime } from '@/lib/time'

import { fetchQuestionImports } from '../api/imports'
import ErrorBox from '../components/ErrorBox.vue'
import { IMPORT_HISTORY_PATH, IMPORT_PATH } from '../lib/import-quality'
import { LOAD_ERROR } from '../lib/ui-errors'

const route = useRoute()
const router = useRouter()

const page = computed(() => {
  const raw = Array.isArray(route.query.page) ? route.query.page[0] : route.query.page
  return Math.max(1, Number.parseInt(raw ?? '', 10) || 1)
})

const { data, error, reload } = useApi(
  (signal) => fetchQuestionImports({ page: page.value, signal }),
  () => route.query.page,
)

const rows = computed(() => data.value?.data ?? [])
const firstLoad = computed(() => data.value === null && error.value === null)

function goToPage(next: number): void {
  void router.push({ path: IMPORT_HISTORY_PATH, query: { page: String(next) } })
}

interface HistoryRow extends Record<string, unknown> {
  id: number
  date: string
  fileName: string
  imported: number
  failed: number
}

const tableRows = computed<HistoryRow[]>(() =>
  rows.value.map((r) => ({
    id: r.id,
    date: formatDateTime(r.createdAt),
    fileName: r.fileName,
    imported: r.importedCount,
    failed: r.failedCount,
  })),
)

const columns: TableColumn<HistoryRow>[] = [
  { accessorKey: 'date', header: 'Tarikh' },
  { accessorKey: 'fileName', header: 'Fail' },
  { accessorKey: 'imported', header: 'Diimport' },
  { accessorKey: 'failed', header: 'Gagal' },
]
const cardFields: CardField[] = [
  { key: 'date', label: 'Tarikh' },
  { key: 'imported', label: 'Diimport' },
  { key: 'failed', label: 'Gagal' },
]
</script>

<template>
  <DsPage data-testid="history-page">
    <div>
      <UButton
        :to="IMPORT_PATH"
        color="neutral"
        variant="soft"
        icon="i-ph-arrow-left"
        class="min-h-11"
        data-testid="history-back"
      >
        Kembali
      </UButton>
    </div>

    <div v-if="error" class="flex flex-col gap-3" data-testid="history-error">
      <ErrorBox :messages="LOAD_ERROR" />
      <div>
        <UButton type="button" class="min-h-11" data-testid="history-retry" @click="reload()">
          Cuba Semula
        </UButton>
      </div>
    </div>

    <DsDataTable
        v-else
      dense
      :data="tableRows"
      :columns="columns"
      caption="Sejarah import"
      :loading="firstLoad"
      :total="data?.meta.totalItems ?? 0"
      :page-size="data?.meta.pageSize ?? 20"
      :page="data?.meta.page ?? page"
      card-title="fileName"
      :card-fields="cardFields"
      empty-label="Tiada sejarah import."
      data-testid="history-table"
      @update:page="goToPage"
    >
      <template #empty>
        <span data-testid="history-empty">Tiada sejarah import.</span>
      </template>
      <template #date-cell="{ row }">
        <span class="whitespace-nowrap" data-testid="history-date">{{ row.original.date }}</span>
      </template>
      <template #fileName-cell="{ row }">
        <span class="break-all" data-testid="history-file">{{ row.original.fileName }}</span>
      </template>
      <template #imported-cell="{ row }">
        <span class="tabular" data-testid="history-imported">{{ row.original.imported }}</span>
      </template>
      <template #failed-cell="{ row }">
        <span class="tabular" data-testid="history-failed">{{ row.original.failed }}</span>
      </template>
    </DsDataTable>
  </DsPage>
</template>
