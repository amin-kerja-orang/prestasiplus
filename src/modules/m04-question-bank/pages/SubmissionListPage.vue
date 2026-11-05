<script setup lang="ts">
/**
 * `/admin/question-submissions` "Kertas Soalan Guru" (R1-ADM-Q-12, FR-ADM-Q12.1, FR-ADM-Q12.5).
 *
 * - Four tiles (Jumlah, Pending, Processing, Selesai; no Ditolak tile), unaffected by the filter.
 * - GET filter (`status`, "Tapis"); "Reset" only while filtered. The query string is the state.
 * - Every row is an intake item of a teacher submission, shown by role label, never by e-mail; each
 *   links to `Semak` on the review screen of its batch.
 * - The table scrolls inside its card below its natural width (design-system §7.4).
 */
import type { TableColumn } from '@nuxt/ui'
import type { IntakeFileSummary, IntakeItemRow } from '@pp/contract'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { ApiError } from '@/api'
import { useApi, useFlash } from '@/composables'
import {
  DsDataTable,
  DsFilterBar,
  DsFormField,
  DsLoadError,
  DsNativeSelect,
  DsPage,
  DsStatRow,
  DsStatusBadge,
  DsText,
  type CardField,
  type StatItem,
} from '@/ds'
import { formatNumber } from '@/lib/number'
import { ImportTabs } from '@/modules/m28-bijak-spm'
import { saveBlob } from '@/lib/save-blob'

import {
  downloadSubmissionFile,
  fetchBatchFiles,
  fetchSubmissionCounts,
  fetchSubmissionItems,
  SUBMISSION_PAGE_SIZE,
} from '../api/submissions'
import { formatEnDate, formatTime } from '../lib/audit-format'
import { SUBMISSIONS_PATH, submissionReviewPath } from '../lib/audit-routes'
import { pageOf, queryText } from '../lib/route-query'
import {
  SUBMISSION_STATUS_DS,
  SUBMISSION_STATUS_OPTIONS,
  submissionStatusOf,
  type SubmissionStatus,
} from '../lib/submission-options'
import { LOAD_ERROR, errorLines } from '../lib/ui-errors'

const route = useRoute()
const router = useRouter()
const flash = useFlash()

const applied = computed(() => queryText(route.query.status))
/** Field 12-01: only the OPT-KIRIMAN-STATUS options filter; `Jumlah` is a tile key, not an option. */
const invalidStatus = computed(
  () => applied.value !== '' && !SUBMISSION_STATUS_OPTIONS.includes(applied.value as SubmissionStatus),
)
const page = computed(() => pageOf(route.query.page))
const status = ref(applied.value)
watch(applied, (value) => {
  status.value = value
})

const { data, error, reload } = useApi(
  async (signal) => {
    if (invalidStatus.value) return null
    const status = applied.value as SubmissionStatus | ''
    const list = await fetchSubmissionItems({ status: status || null, page: page.value, signal })
    const files = await fetchBatchFiles(
      list.data.map((row) => row.batchId),
      signal,
    )
    return { list, files, status }
  },
  () => [route.query.status, route.query.page],
)

// The tiles ignore the filter (FR-ADM-Q12.1), so they load once and survive a failed list.
const { data: counts, error: countsError } = useApi((signal) => fetchSubmissionCounts(signal))

const firstLoad = computed(() => data.value === null && error.value === null && !invalidStatus.value)
const errorText = computed(() =>
  invalidStatus.value || (error.value instanceof ApiError && error.value.status === 422)
    ? 'Nilai penapis tidak sah.'
    : LOAD_ERROR,
)

// A page past the end (the list shrank since the link was made): go to the last page.
watch(data, (result) => {
  if (!result || result.list.data.length > 0 || page.value === 1) return
  const last = Math.ceil(result.list.meta.totalItems / SUBMISSION_PAGE_SIZE)
  if (last > 0) goToPage(last, true)
})

const tile = (value: number | undefined): string => (value === undefined ? '-' : formatNumber(value))

const countItems = computed<StatItem[]>(() => [
  { key: 'all', label: 'Jumlah', value: tile(counts.value?.all), icon: 'stack', accent: 'action' },
  { key: 'pending', label: 'Pending', value: tile(counts.value?.pending), icon: 'clock', accent: 'trial' },
  {
    key: 'processing',
    label: 'Processing',
    value: tile(counts.value?.processing),
    icon: 'gear',
    accent: 'friend',
  },
  { key: 'done', label: 'Selesai', value: tile(counts.value?.done), icon: 'check-circle', accent: 'win' },
])

async function submitFilter(): Promise<void> {
  if (status.value === applied.value) await reload()
  else
    await router.push({
      path: SUBMISSIONS_PATH,
      query: status.value ? { status: status.value } : {},
    })
}

async function resetFilter(): Promise<void> {
  status.value = ''
  await router.push({ path: SUBMISSIONS_PATH })
}

function goToPage(next: number, replace = false): void {
  void router[replace ? 'replace' : 'push']({
    path: SUBMISSIONS_PATH,
    query: { ...(applied.value ? { status: applied.value } : {}), page: String(next) },
  })
}

interface SubmissionTableRow extends Record<string, unknown> {
  id: string
  roleLabel: string
  title: string
  statusLabel: SubmissionStatus
  dateText: string
  files: IntakeFileSummary[]
  raw: IntakeItemRow
}

const tableRows = computed<SubmissionTableRow[]>(() =>
  (data.value?.list.data ?? []).map((row) => ({
    id: row.id,
    roleLabel: 'Guru',
    title: row.stemPreview,
    // A filtered list keeps its filter's word: the server reads the live version, the row the latest.
    statusLabel: data.value?.status || submissionStatusOf(row),
    dateText: `${formatEnDate(row.createdAt)} ${formatTime(row.createdAt)}`,
    files: data.value?.files.get(row.batchId) ?? [],
    raw: row,
  })),
)

const columns: TableColumn<SubmissionTableRow>[] = [
  { accessorKey: 'roleLabel', header: 'Guru / Sekolah' },
  { accessorKey: 'title', header: 'Tajuk' },
  { id: 'files', header: 'Fail' },
  { accessorKey: 'statusLabel', header: 'Status' },
  { accessorKey: 'dateText', header: 'Tarikh' },
  { id: 'actions', header: 'Tindakan' },
]
const cardFields: CardField[] = [
  { key: 'roleLabel', label: 'Guru / Sekolah' },
  { key: 'statusLabel', label: 'Status' },
  { key: 'dateText', label: 'Tarikh' },
]
async function download(file: IntakeFileSummary): Promise<void> {
  try {
    const result = await downloadSubmissionFile(file.id)
    saveBlob(result.blob, result.filename ?? file.originalName)
  } catch (err) {
    flash.show({ type: 'error', message: errorLines(err) })
  }
}

/** The card slot passes the row object. */
const asRow = (row: Record<string, unknown>): SubmissionTableRow => row as SubmissionTableRow
</script>

<template>
  <DsPage
    subtitle="Kertas yang dihantar guru diproses melalui aliran import Studio (DOCX/OCR → semakan → terbit)."
    data-testid="submissions-page"
  >
    <template #tabs>
      <ImportTabs />
    </template>

    <!-- Tiles: 2 per row, 4 from xl. -->
    <DsStatRow
      :items="countItems"
      :cols="4"
      :loading="!counts && !countsError"
      prefix="submissions-count"
    />

    <!-- Filter (the URL is the state). -->
    <DsFilterBar
      :active-count="applied !== '' ? 1 : 0"
      apply-label="Tapis"
      sheet-apply-label="Tapis"
      reset-label="Reset"
      data-testid="submissions-filter"
      @apply="submitFilter"
      @reset="resetFilter"
    >
      <div class="w-full min-w-0 sm:w-56">
        <DsFormField v-slot="{ id }" native for="submissions-status" label="Status">
          <DsNativeSelect
            :id="id"
            v-model="status"
            name="status"
            data-testid="submissions-status"
          >
            <option value="">Semua Status</option>
            <option v-for="o in SUBMISSION_STATUS_OPTIONS" :key="o" :value="o">{{ o }}</option>
          </DsNativeSelect>
        </DsFormField>
      </div>
    </DsFilterBar>

    <DsLoadError
      v-if="error || invalidStatus"
      :message="errorText"
      testid="submissions-error"
      retry-testid="submissions-retry"
      @retry="reload()"
    />

    <DsDataTable
      v-else
      variant="flush"
      :data="tableRows"
      :columns="columns"
      caption="Kertas soalan guru"
      :loading="firstLoad"
      :page="page"
      :page-size="SUBMISSION_PAGE_SIZE"
      :total="data?.list.meta.totalItems ?? 0"
      card-title="title"
      :card-fields="cardFields"
      empty-title="Tiada kertas soalan dihantar oleh guru lagi."
      :filtered="applied !== ''"
      data-testid="submissions-table"
      @update:page="goToPage"
    >
      <template #empty>
        <span data-testid="submissions-empty">Tiada kertas soalan dihantar oleh guru lagi.</span>
      </template>
      <template #title-cell="{ row }">
        <div class="min-w-40">
          <div class="line-clamp-2 text-label text-highlighted" data-testid="submission-title">
            {{ row.original.title }}
          </div>
          <div class="text-caption text-muted">
            {{ row.original.raw.subject }} · {{ row.original.raw.label }}
          </div>
        </div>
      </template>
      <template #files-cell="{ row }">
        <div class="min-w-36">
          <UButton
            v-for="file in row.original.files"
            :key="file.id"
            type="button"
            color="neutral"
            variant="link"
            icon="i-ph-download-simple"
            class="max-w-52 min-h-11 justify-start"
            data-testid="submission-file"
            @click="download(file)"
          >
            <span class="truncate">{{ file.originalName }}</span>
          </UButton>
        </div>
      </template>
      <template #statusLabel-cell="{ row }">
        <DsStatusBadge
          :status="SUBMISSION_STATUS_DS[row.original.statusLabel]"
          :label="row.original.statusLabel"
          data-testid="submission-status"
        />
      </template>
      <template #dateText-cell="{ row }">
        <div class="text-caption whitespace-nowrap text-muted">
          <div>{{ formatEnDate(row.original.raw.createdAt) }}</div>
          <div>{{ formatTime(row.original.raw.createdAt) }}</div>
        </div>
      </template>
      <template #actions-cell="{ row }">
        <UButton
          :to="submissionReviewPath(row.original.raw.batchId)"
          color="neutral"
          variant="outline"
          class="min-h-11"
          data-testid="submission-semak"
        >
          Semak
        </UButton>
      </template>
      <template #card="{ row }">
        <DsText variant="label" tone="highlighted" wrap="anywhere">{{ asRow(row).title }}</DsText>
        <DsText variant="caption" tone="muted">
          {{ asRow(row).roleLabel }} · {{ asRow(row).statusLabel }} · {{ asRow(row).dateText }}
        </DsText>
        <UButton
          v-for="file in asRow(row).files"
          :key="file.id"
          type="button"
          color="neutral"
          variant="link"
          class="max-w-full min-w-0 min-h-11 justify-start"
          data-testid="submission-file"
          @click="download(file)"
        >
          <span class="truncate">{{ file.originalName }}</span>
        </UButton>
      </template>
      <template #card-actions="{ row }">
        <UButton
          :to="submissionReviewPath(asRow(row).raw.batchId)"
          color="neutral"
          variant="outline"
          class="min-h-11"
          data-testid="submission-semak"
        >
          Semak
        </UButton>
      </template>
    </DsDataTable>
  </DsPage>
</template>
