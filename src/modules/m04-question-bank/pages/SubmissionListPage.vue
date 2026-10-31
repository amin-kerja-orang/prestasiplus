<script setup lang="ts">
/**
 * S10 `/admin/question-submissions` "Kertas Soalan - Admin" (M04-T7; FR-M04-91..94, FN-M04-5.1.1..5.1.8).
 *
 * - Four counter cards (Jumlah, Pending, Processing, Selesai; no Ditolak card), unaffected by the
 *   filter.
 * - GET filter (`status`, "Tapis"); "Reset" only while filtered. The query string is the state.
 * - Table of papers, id descending, not paged; "Tiada rekod ditemui" when empty. Each row updates its
 *   status through the inline "Kemaskini" panel; the list then reloads with the API `status` flash.
 * - The table scrolls inside its card below its natural width (design-system §7.4).
 */
import type { TableColumn } from '@nuxt/ui'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useApi, useFlash } from '@/composables'
import {
  DsDataTable,
  DsEmptyState,
  DsFilterBar,
  DsFormField,
  DsLoadError,
  DsNativeSelect,
  DsPage,
  DsStatRow,
  DsStatusBadge,
  type CardField,
  type StatItem,
} from '@/ds'
import { formatNumber } from '@/lib/number'
import { saveBlob } from '@/lib/save-blob'

import {
  downloadSubmissionFile,
  fetchQuestionSubmissions,
  type QuestionSubmission,
} from '../api/submissions'
import SubmissionActions from '../components/SubmissionActions.vue'
import { formatEnDate, formatTime } from '../lib/audit-format'
import { SUBMISSIONS_PATH } from '../lib/audit-routes'
import {
  SUBMISSION_STATUS_DS,
  SUBMISSION_STATUS_LABEL,
  SUBMISSION_STATUS_OPTIONS,
} from '../lib/submission-options'
import { queryText } from '../lib/route-query'
import { SUBMISSIONS_UNAVAILABLE_TITLE, isSubmissionsUnavailable } from '../lib/submissions-unavailable'
import { LOAD_ERROR, errorLines } from '../lib/ui-errors'

const route = useRoute()
const router = useRouter()
const flash = useFlash()

const applied = computed(() => queryText(route.query.status))
const status = ref(applied.value)
watch(applied, (value) => {
  status.value = value
})

const { data, error, reload } = useApi(
  (signal) => fetchQuestionSubmissions({ status: applied.value || null, signal }),
  () => route.query.status,
)

const unavailable = computed(() => isSubmissionsUnavailable(error.value))
const rows = computed(() => data.value?.data ?? [])
const counts = computed(() => data.value?.meta.counts ?? null)
const firstLoad = computed(() => data.value === null && error.value === null)

const countItems = computed<StatItem[]>(() => [
  { key: 'all', label: 'Jumlah', value: formatNumber(counts.value?.all ?? 0), icon: 'stack', accent: 'action' },
  { key: 'pending', label: 'Pending', value: formatNumber(counts.value?.pending ?? 0), icon: 'clock', accent: 'trial' },
  {
    key: 'processing',
    label: 'Processing',
    value: formatNumber(counts.value?.processing ?? 0),
    icon: 'gear',
    accent: 'friend',
  },
  { key: 'done', label: 'Selesai', value: formatNumber(counts.value?.done ?? 0), icon: 'check-circle', accent: 'win' },
])

async function submitFilter(): Promise<void> {
  if (status.value === applied.value) await reload()
  else
    await router.push({
      path: SUBMISSIONS_PATH,
      query: status.value ? { status: status.value } : {},
    })
}

async function onSaved(message: string): Promise<void> {
  await reload()
  flash.show({ type: 'success', message })
}

function onFailed(err: unknown): void {
  flash.show({ type: 'error', message: errorLines(err) })
}

interface SubmissionTableRow extends Record<string, unknown> {
  id: number
  teacherName: string
  paperTitle: string
  fileCount: number
  statusLabel: string
  dateText: string
  raw: QuestionSubmission
}

const tableRows = computed<SubmissionTableRow[]>(() =>
  rows.value.map((s) => ({
    id: s.id,
    teacherName: s.teacher.name ?? '',
    paperTitle: s.subjectText,
    fileCount: s.files.length,
    statusLabel: SUBMISSION_STATUS_LABEL[s.status],
    dateText: `${formatEnDate(s.createdAt)} ${formatTime(s.createdAt)}`,
    raw: s,
  })),
)

const columns: TableColumn<SubmissionTableRow>[] = [
  { accessorKey: 'teacherName', header: 'Guru / Sekolah' },
  { accessorKey: 'paperTitle', header: 'Soalan' },
  { id: 'files', header: 'Fail' },
  { accessorKey: 'statusLabel', header: 'Status' },
  { accessorKey: 'dateText', header: 'Tarikh' },
  { id: 'actions', header: 'Tindakan' },
]
const cardFields: CardField[] = [
  { key: 'paperTitle', label: 'Soalan' },
  { key: 'statusLabel', label: 'Status' },
  { key: 'dateText', label: 'Tarikh' },
]

async function download(submission: QuestionSubmission, index: number): Promise<void> {
  try {
    const file = await downloadSubmissionFile(submission.id, index)
    saveBlob(file.blob, file.filename ?? submission.files[index]?.name ?? 'fail')
  } catch (err) {
    onFailed(err)
  }
}

/** The raw submission of a card row (the card slot passes the row object). */
const rawOf = (row: Record<string, unknown>): QuestionSubmission => row.raw as QuestionSubmission

async function resetFilter(): Promise<void> {
  status.value = ''
  await router.push({ path: SUBMISSIONS_PATH })
}
</script>

<template>
  <DsPage data-testid="submissions-page">
    <!-- Counters: 2 per row, 4 from xl. -->
    <DsStatRow v-if="!unavailable" :items="countItems" :cols="4" :loading="!counts" prefix="submissions-count" />

    <!-- Filter (the URL is the state). -->
    <DsFilterBar
      v-if="!unavailable"
      :active-count="applied !== '' ? 1 : 0"
      apply-label="Tapis"
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
            <option v-for="o in SUBMISSION_STATUS_OPTIONS" :key="o.value" :value="o.value">
              {{ o.label }}
            </option>
          </DsNativeSelect>
        </DsFormField>
      </div>
    </DsFilterBar>

    <DsEmptyState
      v-if="unavailable"
      :title="SUBMISSIONS_UNAVAILABLE_TITLE"
      icon="stack"
      data-testid="unavailable-state"
    />

    <DsLoadError
      v-else-if="error"
      :message="LOAD_ERROR"
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
      :page-size="Math.max(tableRows.length, 1)"
      card-title="teacherName"
      :card-fields="cardFields"
      empty-title="Tiada rekod ditemui"
      :filtered="applied !== ''"
      data-testid="submissions-table"
    >
      <template #empty>
        <span data-testid="submissions-empty">Tiada rekod ditemui</span>
      </template>
      <template #teacherName-cell="{ row }">
        <div class="min-w-40">
          <div class="text-label text-highlighted">{{ row.original.raw.teacher.name }}</div>
          <ULink
            v-if="row.original.raw.teacher.email"
            :href="`mailto:${row.original.raw.teacher.email}`"
            class="block text-caption break-all text-muted"
            >{{ row.original.raw.teacher.email }}</ULink
          >
          <div v-if="row.original.raw.teacher.school" class="mt-1 flex gap-1 text-caption text-muted">
            <UIcon name="i-ph-buildings" class="mt-1 size-4 shrink-0" />
            <span>{{ row.original.raw.teacher.school }}</span>
          </div>
        </div>
      </template>
      <template #paperTitle-cell="{ row }">
        <div class="min-w-40">
          <div class="text-label text-highlighted">
            {{ row.original.raw.subjectText }}
            <span v-if="row.original.raw.levelCode" class="text-caption text-muted">{{
              row.original.raw.levelCode
            }}</span>
            <span class="text-caption text-muted"> ({{ row.original.raw.year }})</span>
          </div>
          <div class="text-caption text-primary-t">{{ row.original.raw.paperType }}</div>
          <div class="text-caption text-muted">Oleh: {{ row.original.raw.authorCredit }}</div>
          <div v-if="row.original.raw.note" class="mt-1 line-clamp-2 text-caption text-muted">
            {{ row.original.raw.note }}
          </div>
        </div>
      </template>
      <template #files-cell="{ row }">
        <div class="min-w-36">
          <UButton
            v-for="file in row.original.raw.files"
            :key="file.index"
            type="button"
            color="neutral"
            variant="link"
            icon="i-ph-download-simple"
            class="max-w-52 min-h-11 justify-start"
            data-testid="submission-file"
            @click="download(row.original.raw, file.index)"
          >
            <span class="truncate">{{ file.name }}</span>
          </UButton>
        </div>
      </template>
      <template #statusLabel-cell="{ row }">
        <div class="min-w-28">
          <DsStatusBadge
            :status="SUBMISSION_STATUS_DS[row.original.raw.status as keyof typeof SUBMISSION_STATUS_DS]"
            :label="SUBMISSION_STATUS_LABEL[row.original.raw.status as keyof typeof SUBMISSION_STATUS_LABEL]"
            data-testid="submission-status"
          />
          <div
            v-if="row.original.raw.adminNotes"
            class="mt-1 text-caption break-words text-muted"
            data-testid="submission-admin-notes"
          >
            {{ row.original.raw.adminNotes }}
          </div>
        </div>
      </template>
      <template #dateText-cell="{ row }">
        <div class="text-caption whitespace-nowrap text-muted">
          <div>{{ formatEnDate(row.original.raw.createdAt) }}</div>
          <div>{{ formatTime(row.original.raw.createdAt) }}</div>
        </div>
      </template>
      <template #actions-cell="{ row }">
        <SubmissionActions :submission="row.original.raw" @saved="onSaved" @failed="onFailed" />
      </template>
      <template #card-actions="{ row }">
        <SubmissionActions :submission="rawOf(row)" @saved="onSaved" @failed="onFailed" />
      </template>
    </DsDataTable>
  </DsPage>
</template>
