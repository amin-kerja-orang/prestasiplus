<script setup lang="ts">
/**
 * S1 `/admin/questions` "Pengurusan Soalan" (M04-T3; FR-M04-01..16). v2: Portal Pentadbiran staff theme.
 *
 * - The create button, the summary card with the 31 subject tiles, the 8-field filter bar (the URL is
 *   the state), the table of 20 rows with bulk select, and the server pager.
 * - Bulk bar: the action select is `required`; confirmation through `useConfirm`; the API `status` is the flash.
 * - The table scrolls inside its card; below `md` every row is a card.
 */
import type { TableColumn } from '@nuxt/ui'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useApi, useFlash } from '@/composables'
import { DsDataTable, DsEmptyState, DsFilterBar, DsPage, useConfirm, type CardField } from '@/ds'

import {
  bulkQuestionAction,
  deleteQuestion,
  fetchEducationLevels,
  fetchQuestions,
  fetchQuestionSummary,
  fetchSubjects,
  type QuestionRow,
} from '../api'
import ErrorBox from '../components/ErrorBox.vue'
import NativeSelect from '../components/native/NativeSelect.vue'
import QuestionSummaryCard from '../components/QuestionSummaryCard.vue'
import {
  BULK_OPTIONS,
  bulkConfirmText,
  COMPLIANCE_OPTIONS,
  complianceColor,
  DELETE_CONFIRM,
  DIFFICULTY_OPTIONS,
  DSKP_OPTIONS,
  excerpt,
  FILTER_KEYS,
  QUESTIONS_CREATE_PATH,
  QUESTIONS_LIST_PATH,
  questionDetailPath,
  questionEditPath,
  SOURCE_OPTIONS,
  sourceLabel,
  statusColor,
  statusLabel,
  STATUS_OPTIONS,
  type FilterKey,
} from '../lib/question-list'
import { pageOf, queryText } from '../lib/route-query'
import { errorLines, LOAD_ERROR } from '../lib/ui-errors'

const route = useRoute()
const router = useRouter()
const flash = useFlash()
const confirm = useConfirm()

/** The applied filters, read from the URL (the source of truth, as the live GET form). */
const applied = computed(() => {
  const out = {} as Record<FilterKey, string>
  for (const key of FILTER_KEYS) out[key] = queryText(route.query[key]).trim()
  return out
})
const page = computed(() => pageOf(route.query.page))
const activeSubjectId = computed(() => {
  const n = Number.parseInt(applied.value.subject_id, 10)
  return Number.isFinite(n) && n > 0 ? n : null
})
const activeCount = computed(() => FILTER_KEYS.filter((k) => applied.value[k] !== '').length)

// Draft values of the form controls; re-synced when the URL changes.
const draft = ref<Record<FilterKey, string>>(
  Object.fromEntries(FILTER_KEYS.map((k) => [k, queryText(route.query[k])])) as Record<
    FilterKey,
    string
  >,
)
watch(
  () => FILTER_KEYS.map((k) => route.query[k]),
  () => {
    for (const key of FILTER_KEYS) draft.value[key] = queryText(route.query[key])
  },
)

const list = useApi(
  (signal) =>
    fetchQuestions({
      subjectId: applied.value.subject_id || null,
      educationLevelId: applied.value.education_level_id || null,
      difficultyLevel: applied.value.difficulty_level || null,
      status: applied.value.status || null,
      dskpFilter: applied.value.dskp_filter || null,
      complianceFilter: applied.value.compliance_filter || null,
      sourceFilter: applied.value.source_filter || null,
      search: applied.value.search || null,
      page: page.value,
      signal,
    }),
  [...FILTER_KEYS.map((k) => () => route.query[k]), () => route.query.page],
)
const summary = useApi((signal) => fetchQuestionSummary({ signal }))
const subjects = useApi((signal) => fetchSubjects({ signal }))
const levels = useApi((signal) => fetchEducationLevels({ signal }))

const rows = computed<QuestionRow[]>(() => list.data.value?.data ?? [])
const firstLoad = computed(() => list.data.value === null && list.error.value === null)
const subjectOptions = computed(() => subjects.data.value?.data ?? [])
const levelOptions = computed(() => levels.data.value?.data ?? [])

/** The applied filters as the query of the pager links (empty ones dropped). */
const pagerQuery = computed(() => {
  const out: Record<string, string> = {}
  for (const key of FILTER_KEYS) if (applied.value[key] !== '') out[key] = applied.value[key]
  return out
})

async function submitFilter(): Promise<void> {
  const query: Record<string, string> = {}
  for (const key of FILTER_KEYS) {
    const value = draft.value[key].trim()
    if (value !== '') query[key] = value
  }
  // Submitting the same filter reloads the page, as a live GET form does.
  if (JSON.stringify(query) === JSON.stringify(pagerQuery.value) && !route.query.page) {
    await Promise.all([list.reload(), summary.reload()])
  } else {
    await router.push({ path: QUESTIONS_LIST_PATH, query })
  }
}

async function resetFilter(): Promise<void> {
  for (const key of FILTER_KEYS) draft.value[key] = ''
  await router.push({ path: QUESTIONS_LIST_PATH })
}

function goToPage(next: number): void {
  void router.push({
    path: QUESTIONS_LIST_PATH,
    query: { ...pagerQuery.value, page: String(next) },
  })
}

// --- Selection (FR-M04-12): page/filter changes clear it.
const selected = ref<number[]>([])
const allSelected = computed(
  () => rows.value.length > 0 && rows.value.every((r) => selected.value.includes(r.id)),
)
watch(
  () => route.fullPath,
  () => {
    selected.value = []
  },
)
function toggleAll(checked: boolean | 'indeterminate'): void {
  selected.value = checked === true ? rows.value.map((r) => r.id) : []
}
function toggleOne(id: number, checked: boolean | 'indeterminate'): void {
  const rest = selected.value.filter((v) => v !== id)
  selected.value = checked === true ? [...rest, id] : rest
}

// --- Bulk action and delete (FR-M04-13, 14, 16).
const busy = ref(false)
const bulkAction = ref('')

/** Reloads after a mutation; steps back a page when the current one became empty. */
async function reloadAfterMutation(): Promise<void> {
  await Promise.all([list.reload(), summary.reload()])
  if (rows.value.length === 0 && page.value > 1) {
    await router.push({
      path: QUESTIONS_LIST_PATH,
      query: { ...pagerQuery.value, page: String(page.value - 1) },
    })
  }
}

async function submitBulk(): Promise<void> {
  // The native `required` on the select already blocked an empty action; this guard is for tests.
  const option = BULK_OPTIONS.find((o) => o.value === bulkAction.value)
  if (!option || busy.value || selected.value.length === 0) return
  if (!(await confirm({ message: bulkConfirmText(option.verb, selected.value.length) }))) return
  busy.value = true
  try {
    const result = await bulkQuestionAction(option.value, selected.value)
    selected.value = []
    bulkAction.value = ''
    await reloadAfterMutation()
    flash.show({ type: 'success', message: result.status })
  } catch (err) {
    flash.show({ type: 'error', message: errorLines(err) })
  } finally {
    busy.value = false
  }
}

async function remove(row: QuestionRow): Promise<void> {
  if (busy.value) return
  if (!(await confirm({ message: DELETE_CONFIRM, tone: 'danger' }))) return
  busy.value = true
  try {
    const result = await deleteQuestion(row.id)
    selected.value = selected.value.filter((id) => id !== row.id)
    await reloadAfterMutation()
    flash.show({ type: 'success', message: result.status })
  } catch (err) {
    flash.show({ type: 'error', message: errorLines(err) })
  } finally {
    busy.value = false
  }
}

interface TableRow extends Record<string, unknown> {
  id: number
  excerptText: string
  subjectName: string
  levelName: string
  raw: QuestionRow
}

const tableRows = computed<TableRow[]>(() =>
  rows.value.map((r) => ({
    id: r.id,
    excerptText: excerpt(r.questionText),
    subjectName: r.subject?.name ?? '-',
    levelName: r.level?.name ?? '-',
    raw: r,
  })),
)

const columns: TableColumn<TableRow>[] = [
  { id: 'select', header: ' ' },
  { accessorKey: 'id', header: '#' },
  { accessorKey: 'excerptText', header: 'Soalan' },
  { accessorKey: 'subjectName', header: 'Subjek' },
  { accessorKey: 'levelName', header: 'Tahap' },
  { id: 'difficulty', header: 'Kesukaran' },
  { id: 'status', header: 'Status' },
  { id: 'actions', header: 'Tindakan' },
]
const cardFields: CardField[] = [
  { key: 'subjectName', label: 'Subjek' },
  { key: 'levelName', label: 'Tahap' },
]
</script>

<template>
  <DsPage data-testid="questions-page">
    <!-- Subtitle and the create button ("Tambah Soalan" >= 640px, "Tambah" below). -->
    <div class="flex items-center justify-between gap-3">
      <p class="min-w-0 text-body text-muted">Urus bank soalan untuk platform PRESTASIPLUS</p>
      <UButton
        :to="QUESTIONS_CREATE_PATH"
        icon="i-ph-plus"
        class="min-h-11 shrink-0"
        data-testid="questions-add"
      >
        <span class="hidden sm:inline">Tambah Soalan</span>
        <span class="sm:hidden">Tambah</span>
      </UButton>
    </div>

    <QuestionSummaryCard :summary="summary.data.value" :active-subject-id="activeSubjectId" />

    <!-- Filter (the URL is the state). -->
    <DsFilterBar
      :active-count="activeCount"
      data-testid="questions-filter"
      @apply="submitFilter"
      @reset="resetFilter"
    >
      <div class="w-full min-w-0 sm:w-48">
        <label for="q-subject" class="mb-2 block text-label text-highlighted">Subjek</label>
        <NativeSelect
          id="q-subject"
          v-model="draft.subject_id"
          name="subject_id"
          data-testid="questions-subject"
        >
          <option value="">Semua Subjek</option>
          <option v-for="s in subjectOptions" :key="s.id" :value="String(s.id)">
            {{ s.name }}
          </option>
        </NativeSelect>
      </div>
      <div class="w-full min-w-0 sm:w-48">
        <label for="q-level" class="mb-2 block text-label text-highlighted">Tahap</label>
        <NativeSelect
          id="q-level"
          v-model="draft.education_level_id"
          name="education_level_id"
          data-testid="questions-level"
        >
          <option value="">Semua Tahap</option>
          <option v-for="l in levelOptions" :key="l.id" :value="String(l.id)">{{ l.name }}</option>
        </NativeSelect>
      </div>
      <div class="w-full min-w-0 sm:w-48">
        <label for="q-difficulty" class="mb-2 block text-label text-highlighted">Kesukaran</label>
        <NativeSelect
          id="q-difficulty"
          v-model="draft.difficulty_level"
          name="difficulty_level"
          data-testid="questions-difficulty"
        >
          <option value="">Semua</option>
          <option v-for="o in DIFFICULTY_OPTIONS" :key="o.value" :value="o.value">
            {{ o.label }}
          </option>
        </NativeSelect>
      </div>
      <div class="w-full min-w-0 sm:w-48">
        <label for="q-status" class="mb-2 block text-label text-highlighted">Status</label>
        <NativeSelect
          id="q-status"
          v-model="draft.status"
          name="status"
          data-testid="questions-status"
        >
          <option value="">Semua Status</option>
          <option v-for="o in STATUS_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
        </NativeSelect>
      </div>
      <div class="w-full min-w-0 sm:w-48">
        <label for="q-dskp" class="mb-2 block text-label text-highlighted">DSKP</label>
        <NativeSelect
          id="q-dskp"
          v-model="draft.dskp_filter"
          name="dskp_filter"
          data-testid="questions-dskp"
        >
          <option value="">Semua</option>
          <option v-for="o in DSKP_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
        </NativeSelect>
      </div>
      <div class="w-full min-w-0 sm:w-48">
        <label for="q-compliance" class="mb-2 block text-label text-highlighted">Compliance</label>
        <NativeSelect
          id="q-compliance"
          v-model="draft.compliance_filter"
          name="compliance_filter"
          data-testid="questions-compliance"
        >
          <option value="">Semua</option>
          <option v-for="o in COMPLIANCE_OPTIONS" :key="o.value" :value="o.value">
            {{ o.label }}
          </option>
        </NativeSelect>
      </div>
      <div class="w-full min-w-0 sm:w-48">
        <label for="q-source" class="mb-2 block text-label text-highlighted">Source</label>
        <NativeSelect
          id="q-source"
          v-model="draft.source_filter"
          name="source_filter"
          data-testid="questions-source"
        >
          <option value="">Semua</option>
          <option v-for="o in SOURCE_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
        </NativeSelect>
      </div>
      <template #search>
        <div class="w-full min-w-0 sm:w-64">
        <label for="q-search" class="mb-2 block text-label text-highlighted">Cari</label>
          <UInput
            id="q-search"
            v-model="draft.search"
            type="text"
            name="search"
            placeholder="Cari soalan..."
            icon="i-ph-magnifying-glass"
            class="w-full"
            data-testid="questions-search"
          />
        </div>
      </template>
    </DsFilterBar>

    <!-- Load failure: alert in place of the table + retry (INFERRED copy, SRS §8.2). -->
    <div v-if="list.error.value" class="flex flex-col gap-3" data-testid="questions-error">
      <ErrorBox :messages="LOAD_ERROR" />
      <div>
        <UButton
          type="button"
          class="min-h-11"
          data-testid="questions-retry"
          @click="list.reload()"
        >
          Cuba Semula
        </UButton>
      </div>
    </div>

    <!-- Empty: table and pager are not rendered (FR-M04-11). -->
    <UCard v-else-if="!firstLoad && rows.length === 0" data-testid="questions-empty">
      <DsEmptyState title="Tiada soalan dijumpai" icon="i-ph-tray">
        <template #actions>
          <UButton
            :to="QUESTIONS_CREATE_PATH"
            variant="link"
            icon="i-ph-plus"
            class="min-h-11"
            data-testid="questions-empty-add"
            >Tambah Soalan Pertama</UButton
          >
        </template>
      </DsEmptyState>
    </UCard>

    <div v-else class="flex flex-col gap-3">
      <UCard v-if="selected.length > 0">
      <form
        method="post"
        class="flex flex-wrap items-center gap-3"
        data-testid="questions-bulk-bar"
        @submit.prevent="submitBulk"
      >
        <span class="inline-flex items-center gap-2 text-label text-highlighted">
          <UIcon name="i-ph-check-square" class="size-5 text-primary" />
          <span class="tabular" data-testid="questions-selected-count">{{ selected.length }}</span>
          soalan dipilih
        </span>
        <NativeSelect
          v-model="bulkAction"
          name="action"
          required
          class="w-auto"
          data-testid="questions-bulk-action"
        >
          <option value="">Pilih Tindakan</option>
          <option v-for="o in BULK_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
        </NativeSelect>
        <UButton type="submit" :disabled="busy" class="min-h-11" data-testid="questions-bulk-submit">
          Laksanakan
        </UButton>
      </form>
      </UCard>

      <DsDataTable
        :data="tableRows"
        :columns="columns"
        caption="Senarai soalan"
        :loading="firstLoad"
        :total="list.data.value?.meta.totalItems ?? 0"
        :page-size="list.data.value?.meta.pageSize ?? 20"
        :page="list.data.value?.meta.page ?? page"
        card-title="excerptText"
        :card-fields="cardFields"
        empty-label="Tiada soalan dijumpai"
        data-testid="questions-table"
        @update:page="goToPage"
      >
        <template #select-header>
          <UCheckbox
            :model-value="allSelected"
            aria-label="Pilih semua soalan"
            data-testid="questions-select-all"
            @update:model-value="toggleAll"
          />
        </template>
        <template #select-cell="{ row }">
          <UCheckbox
            :model-value="selected.includes(row.original.id)"
            :aria-label="`Pilih soalan ${row.original.id}`"
            data-testid="question-select"
            @update:model-value="toggleOne(row.original.id, $event)"
          />
        </template>
        <template #id-cell="{ row }">
          <span data-testid="question-id">{{ row.original.id }}</span>
        </template>
        <template #excerptText-cell="{ row }">
          <div class="flex min-w-60 flex-col gap-1">
            <p class="break-words text-highlighted" data-testid="question-text">
              {{ row.original.excerptText }}
            </p>
            <div class="flex flex-wrap items-center gap-1">
              <UBadge
                v-if="row.original.raw.dskpTagged"
                color="success"
                variant="subtle"
                icon="i-ph-check-circle"
                label="DSKP"
                data-testid="question-dskp"
              />
              <UBadge
                v-else
                color="neutral"
                variant="subtle"
                icon="i-ph-book-open"
                label="Latihan Tambahan"
                data-testid="question-dskp"
              />
              <UBadge
                :color="complianceColor(row.original.raw.complianceStatus)"
                variant="subtle"
                :label="row.original.raw.complianceStatus.replaceAll('_', ' ').toUpperCase()"
                data-testid="question-compliance"
              />
              <UBadge
                v-if="row.original.raw.aiVerified"
                color="info"
                variant="subtle"
                label="AI Verified"
                data-testid="question-ai-verified"
              />
            </div>
            <p class="text-caption break-words text-muted" data-testid="question-source">
              Source: {{ sourceLabel(row.original.raw.sourceType) }}
            </p>
            <p
              v-if="row.original.raw.sourceFile"
              class="text-caption break-words text-muted"
              data-testid="question-source-file"
            >
              {{ row.original.raw.sourceFile }}
            </p>
          </div>
        </template>
        <template #difficulty-cell="{ row }">
          <span
            class="inline-flex gap-1 whitespace-nowrap"
            data-testid="question-stars"
            :aria-label="`Kesukaran ${row.original.raw.difficultyLevel} daripada 5`"
          >
            <UIcon
              v-for="n in 5"
              :key="n"
              :name="
                n <= row.original.raw.difficultyLevel ? 'i-ph-star-fill' : 'i-ph-star'
              "
              class="size-4"
              :class="n <= row.original.raw.difficultyLevel ? 'text-warning' : 'text-dimmed'"
              :data-filled="n <= row.original.raw.difficultyLevel ? 'true' : 'false'"
            />
          </span>
        </template>
        <template #status-cell="{ row }">
          <div class="flex flex-col items-start gap-1">
            <UBadge
              :color="statusColor(row.original.raw.status)"
              variant="subtle"
              :label="statusLabel(row.original.raw.status, true)"
              data-testid="question-status"
            />
            <span
              class="text-caption"
              :class="row.original.raw.isActive ? 'text-success' : 'text-error'"
              data-testid="question-active"
              >{{ row.original.raw.isActive ? 'ACTIVE' : 'INACTIVE' }}</span
            >
          </div>
        </template>
        <template #actions-cell="{ row }">
          <div class="flex items-center gap-1">
            <UButton
              :to="questionDetailPath(row.original.id)"
              color="neutral"
              variant="ghost"
              icon="i-ph-eye"
              aria-label="Lihat"
              title="Lihat"
              class="min-h-11 min-w-11 justify-center"
              data-testid="question-view"
            />
            <UButton
              :to="questionEditPath(row.original.id)"
              color="neutral"
              variant="ghost"
              icon="i-ph-pencil-simple"
              aria-label="Edit"
              title="Edit"
              class="min-h-11 min-w-11 justify-center"
              data-testid="question-edit"
            />
            <UButton
              type="button"
              color="error"
              variant="ghost"
              icon="i-ph-trash"
              aria-label="Padam"
              title="Padam"
              :disabled="busy"
              class="min-h-11 min-w-11 justify-center"
              data-testid="question-delete"
              @click="remove(row.original.raw)"
            />
          </div>
        </template>
        <template #card-actions="{ row }">
          <div class="flex items-center gap-1">
            <UButton
              :to="questionDetailPath(row.id as number)"
              color="neutral"
              variant="soft"
              icon="i-ph-eye"
              aria-label="Lihat"
              class="min-h-11 min-w-11 justify-center"
            />
            <UButton
              :to="questionEditPath(row.id as number)"
              color="neutral"
              variant="soft"
              icon="i-ph-pencil-simple"
              aria-label="Edit"
              class="min-h-11 min-w-11 justify-center"
            />
            <UButton
              type="button"
              color="error"
              variant="soft"
              icon="i-ph-trash"
              aria-label="Padam"
              :disabled="busy"
              class="min-h-11 min-w-11 justify-center"
              @click="remove(row.raw as QuestionRow)"
            />
          </div>
        </template>
      </DsDataTable>
    </div>
  </DsPage>
</template>
