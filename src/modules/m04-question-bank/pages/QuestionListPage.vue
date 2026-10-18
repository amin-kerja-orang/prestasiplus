<script setup lang="ts">
/**
 * S1 `/admin/questions` "Pengurusan Soalan" (M04-T3; FR-M04-01..16). v2: Portal Pentadbiran staff theme,
 * built from the design-system blocks (docs/design/v2-design-language.md 9.2).
 *
 * Admin-list pattern:
 * - `DsPage` header: the subtitle and the create button; a KPI strip + collapsible subject table;
 * - `DsFilterBar` (search + Cari, 3 inline selects, a "Lagi Penapis" popover, a drawer below `md`) and
 *   `DsActiveFilters` chips; the URL is the state;
 * - `DsDataTable` (bulk select, `DsRowActions`) with the server pager and a page-size select.
 * - Bulk bar: the action select is `required`; confirmation through `useConfirm`; the API `status` is the flash.
 * - The table fits the width from `xl`; below that Tahap folds into Subjek; below `md` rows are cards.
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
  DsPanel,
  DsRowActions,
  DsStatusBadge,
  useConfirm,
  type CardField,
  type RowAction,
} from '@/ds'
import { useMedia } from '@/ds/useMedia'

import {
  bulkQuestionAction,
  deleteQuestion,
  fetchEducationLevels,
  fetchQuestions,
  fetchQuestionSummary,
  fetchSubjects,
  type QuestionRow,
} from '../api'
import QuestionSummaryCard from '../components/QuestionSummaryCard.vue'
import {
  BULK_OPTIONS,
  bulkConfirmText,
  COMPLIANCE_OPTIONS,
  complianceColor,
  DELETE_CONFIRM,
  DIFFICULTY_LABELS,
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
  statusDs,
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
/** The columns fit the width from `xl`; below that the table scrolls inside its own container. */
const xl = useMedia('(min-width: 1280px)')

const PAGE_SIZES = [20, 50, 100]
const DEFAULT_PAGE_SIZE = 20

/** The applied filters, read from the URL (the source of truth, as the live GET form). */
const applied = computed(() => {
  const out = {} as Record<FilterKey, string>
  for (const key of FILTER_KEYS) out[key] = queryText(route.query[key]).trim()
  return out
})
const page = computed(() => pageOf(route.query.page))
const perPage = computed(() => {
  const n = Number.parseInt(queryText(route.query.per_page), 10)
  return PAGE_SIZES.includes(n) ? n : DEFAULT_PAGE_SIZE
})
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
      pageSize: perPage.value === DEFAULT_PAGE_SIZE ? null : perPage.value,
      signal,
    }),
  [
    ...FILTER_KEYS.map((k) => () => route.query[k]),
    () => route.query.page,
    () => route.query.per_page,
  ],
)
const summary = useApi((signal) => fetchQuestionSummary({ signal }))
const subjects = useApi((signal) => fetchSubjects({ signal }))
const levels = useApi((signal) => fetchEducationLevels({ signal }))

const rows = computed<QuestionRow[]>(() => list.data.value?.data ?? [])
const firstLoad = computed(() => list.data.value === null && list.error.value === null)
const subjectOptions = computed(() => subjects.data.value?.data ?? [])
const levelOptions = computed(() => levels.data.value?.data ?? [])

/** The applied filters (and the page size) as the query of the pager links (empty ones dropped). */
const pagerQuery = computed(() => {
  const out: Record<string, string> = {}
  for (const key of FILTER_KEYS) if (applied.value[key] !== '') out[key] = applied.value[key]
  if (perPage.value !== DEFAULT_PAGE_SIZE) out.per_page = String(perPage.value)
  return out
})

// --- Filter fields: one definition drives the bar, the popover, the drawer and the chips.
interface FieldDef {
  key: FilterKey
  id: string
  label: string
  empty: string
  testid: string
  options: { value: string; label: string }[]
}
const PRIMARY_FIELDS = computed<FieldDef[]>(() => [
  {
    key: 'subject_id',
    id: 'q-subject',
    label: 'Subjek',
    empty: 'Semua Subjek',
    testid: 'questions-subject',
    options: subjectOptions.value.map((s) => ({ value: String(s.id), label: s.name })),
  },
  {
    key: 'education_level_id',
    id: 'q-level',
    label: 'Tahap',
    empty: 'Semua Tahap',
    testid: 'questions-level',
    options: levelOptions.value.map((l) => ({ value: String(l.id), label: l.name })),
  },
  {
    key: 'status',
    id: 'q-status',
    label: 'Status',
    empty: 'Semua Status',
    testid: 'questions-status',
    options: STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
  },
])
const MORE_FIELDS: FieldDef[] = [
  {
    key: 'difficulty_level',
    id: 'q-difficulty',
    label: 'Kesukaran',
    empty: 'Semua Kesukaran',
    testid: 'questions-difficulty',
    options: DIFFICULTY_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
  },
  {
    key: 'dskp_filter',
    id: 'q-dskp',
    label: 'DSKP',
    empty: 'Semua DSKP',
    testid: 'questions-dskp',
    options: DSKP_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
  },
  {
    key: 'compliance_filter',
    id: 'q-compliance',
    label: 'Compliance',
    empty: 'Semua Compliance',
    testid: 'questions-compliance',
    options: COMPLIANCE_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
  },
  {
    key: 'source_filter',
    id: 'q-source',
    label: 'Source',
    empty: 'Semua Source',
    testid: 'questions-source',
    options: SOURCE_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
  },
]
const ALL_FIELDS = computed(() => [...PRIMARY_FIELDS.value, ...MORE_FIELDS])
const moreActive = computed(() => MORE_FIELDS.filter((f) => applied.value[f.key] !== '').length)

const chips = computed(() => {
  const out: { key: FilterKey; label: string }[] = []
  for (const f of ALL_FIELDS.value) {
    const v = applied.value[f.key]
    if (v === '') continue
    const label = f.options.find((o) => o.value === v)?.label ?? v
    out.push({ key: f.key, label: `${f.label}: ${label}` })
  }
  if (applied.value.search !== '') {
    out.push({ key: 'search', label: `Cari: ${applied.value.search}` })
  }
  return out
})

async function submitFilter(): Promise<void> {
  const query: Record<string, string> = {}
  for (const key of FILTER_KEYS) {
    const value = draft.value[key].trim()
    if (value !== '') query[key] = value
  }
  if (perPage.value !== DEFAULT_PAGE_SIZE) query.per_page = String(perPage.value)
  // Submitting the same filter reloads the page, as a live GET form does.
  if (JSON.stringify(query) === JSON.stringify(pagerQuery.value) && !route.query.page) {
    await Promise.all([list.reload(), summary.reload()])
  } else {
    await router.push({ path: QUESTIONS_LIST_PATH, query })
  }
}

async function resetFilter(): Promise<void> {
  for (const key of FILTER_KEYS) draft.value[key] = ''
  await router.push({
    path: QUESTIONS_LIST_PATH,
    ...(perPage.value !== DEFAULT_PAGE_SIZE ? { query: { per_page: String(perPage.value) } } : {}),
  })
}

function removeChip(key: string): void {
  draft.value[key as FilterKey] = ''
  const query = { ...pagerQuery.value }
  Reflect.deleteProperty(query, key)
  void router.push({ path: QUESTIONS_LIST_PATH, query })
}

function goToPage(next: number): void {
  void router.push({
    path: QUESTIONS_LIST_PATH,
    query: { ...pagerQuery.value, page: String(next) },
  })
}

function setPageSize(size: number): void {
  const query = { ...pagerQuery.value }
  Reflect.deleteProperty(query, 'per_page')
  if (size !== DEFAULT_PAGE_SIZE) query.per_page = String(size)
  void router.push({ path: QUESTIONS_LIST_PATH, query })
}

interface TableRow extends Record<string, unknown> {
  id: number
  excerptText: string
  subjectName: string
  levelName: string
  statusText: string
  difficultyText: string
  raw: QuestionRow
}

// --- Selection (FR-M04-12): page/filter changes clear it.
const selected = ref<TableRow[]>([])
watch(
  () => route.fullPath,
  () => {
    selected.value = []
  },
)

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
    const result = await bulkQuestionAction(
      option.value,
      selected.value.map((r) => r.id),
    )
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

/** The confirmation ran in `DsRowActions` (live message); this only calls the API. */
async function remove(row: QuestionRow): Promise<void> {
  if (busy.value) return
  busy.value = true
  try {
    const result = await deleteQuestion(row.id)
    selected.value = selected.value.filter((r) => r.id !== row.id)
    await reloadAfterMutation()
    flash.show({ type: 'success', message: result.status })
  } catch (err) {
    flash.show({ type: 'error', message: errorLines(err) })
  } finally {
    busy.value = false
  }
}

/** Lihat and Edit stay one click away as buttons; the menu holds the destructive one. */
function rowActions(row: QuestionRow): RowAction[] {
  return [
    {
      label: 'Lihat',
      icon: 'i-ph-eye',
      to: questionDetailPath(row.id),
      testid: 'question-view',
    },
    {
      label: 'Edit',
      icon: 'i-ph-pencil-simple',
      to: questionEditPath(row.id),
      testid: 'question-edit',
    },
    {
      label: 'Padam',
      icon: 'i-ph-trash',
      danger: true,
      disabled: busy.value,
      confirm: { title: 'Padam Soalan?', body: DELETE_CONFIRM, confirmLabel: 'Padam' },
      onSelect: () => void remove(row),
    },
  ]
}

const tableRows = computed<TableRow[]>(() =>
  rows.value.map((r) => ({
    id: r.id,
    excerptText: excerpt(r.questionText),
    subjectName: r.subject?.name ?? '-',
    levelName: r.level?.name ?? '-',
    statusText: statusLabel(r.status, true),
    difficultyText: `${String(r.difficultyLevel)} / 5`,
    raw: r,
  })),
)

// Per-cell classes under the key `class`; computed so the class linter does not read the key as a list.
// eslint-disable-next-line pp/ds-class-allowlist -- an object key, not a class list
const META_CLASS = 'class'
const cellClass = (th: string, td = th): { meta: Record<string, unknown> } => ({
  meta: { [META_CLASS]: { th, td } },
})

const columns: TableColumn<TableRow>[] = [
  { accessorKey: 'id', header: 'ID', ...cellClass('w-16') },
  { accessorKey: 'excerptText', header: 'Soalan', ...cellClass('min-w-64') },
  { accessorKey: 'subjectName', header: 'Subjek', ...cellClass('w-32 xl:w-36') },
  { accessorKey: 'levelName', header: 'Tahap', ...cellClass('hidden 2xl:table-cell w-40') },
  { id: 'difficulty', header: 'Kesukaran', ...cellClass('w-28') },
  { id: 'status', header: 'Status', ...cellClass('w-32') },
  { id: 'actions', header: ' ', ...cellClass('w-64 text-end', 'w-64') },
]
const cardFields: CardField[] = [
  { key: 'subjectName', label: 'Subjek' },
  { key: 'levelName', label: 'Tahap' },
  { key: 'statusText', label: 'Status' },
  { key: 'difficultyText', label: 'Kesukaran' },
]
</script>

<template>
  <DsPage subtitle="Urus bank soalan untuk platform PRESTASIPLUS" data-testid="questions-page">
    <template #actions>
      <UButton
        :to="QUESTIONS_CREATE_PATH"
        icon="i-ph-plus"
        class="min-h-11 shrink-0"
        data-testid="questions-add"
      >
        <span class="hidden sm:inline">Tambah Soalan</span>
        <span class="sm:hidden">Tambah</span>
      </UButton>
    </template>

    <QuestionSummaryCard :summary="summary.data.value" :active-subject-id="activeSubjectId" />

    <!-- Filter bar (the URL is the state). -->
    <DsFilterBar
      :active-count="activeCount"
      :chips="chips"
      :more-count="moreActive"
      data-testid="questions-filter"
      @apply="submitFilter"
      @reset="resetFilter"
      @remove-chip="removeChip"
    >
      <template #search>
        <div class="min-w-0 grow sm:basis-40">
          <UInput
            v-model="draft.search"
            type="text"
            name="search"
            placeholder="Cari soalan..."
            aria-label="Cari"
            icon="i-ph-magnifying-glass"
            class="w-full"
            data-testid="questions-search"
          />
        </div>
      </template>

      <div v-for="f in PRIMARY_FIELDS" :key="f.key" class="w-full min-w-0 md:w-40 2xl:w-52">
        <DsNativeSelect
          :id="f.id"
          v-model="draft[f.key]"
          :name="f.key"
          :aria-label="f.label"
          :data-testid="f.testid"
        >
          <option value="">{{ f.empty }}</option>
          <option v-for="o in f.options" :key="o.value" :value="o.value">{{ o.label }}</option>
        </DsNativeSelect>
      </div>

      <template #more>
        <DsFormField
          v-for="f in MORE_FIELDS"
          :key="f.key"
          v-slot="{ id }"
          native
          :for="f.id"
          :label="f.label"
        >
          <DsNativeSelect
            :id="id"
            v-model="draft[f.key]"
            :name="f.key"
            :data-testid="f.testid"
          >
            <option value="">{{ f.empty }}</option>
            <option v-for="o in f.options" :key="o.value" :value="o.value">{{ o.label }}</option>
          </DsNativeSelect>
        </DsFormField>
      </template>
    </DsFilterBar>

    <!-- Load failure: alert in place of the table + retry (INFERRED copy, SRS §8.2). -->
    <DsLoadError
      v-if="list.error.value"
      :message="LOAD_ERROR"
      testid="questions-error"
      retry-testid="questions-retry"
      @retry="list.reload()"
    />

    <!-- Empty: table and pager are not rendered (FR-M04-11). -->
    <DsPanel v-else-if="!firstLoad && rows.length === 0" data-testid="questions-empty">
      <DsEmptyState title="Tiada soalan dijumpai" icon="tray" :filtered="activeCount > 0">
        <template #actions>
          <UButton
            :to="QUESTIONS_CREATE_PATH"
            variant="link"
            icon="i-ph-plus"
            data-testid="questions-empty-add"
            >Tambah Soalan Pertama</UButton
          >
        </template>
      </DsEmptyState>
    </DsPanel>

    <div v-else class="flex flex-col gap-4">
      <DsPanel v-if="selected.length > 0" tone="bulk">
        <form
          method="post"
          class="flex flex-wrap items-center gap-3"
          data-testid="questions-bulk-bar"
          @submit.prevent="submitBulk"
        >
          <span class="inline-flex items-center gap-2 ps-2 text-label text-highlighted">
            <UIcon name="i-ph-check-square" class="size-5 text-primary" />
            <span class="tabular" data-testid="questions-selected-count">{{ selected.length }}</span>
            soalan dipilih
          </span>
          <div class="w-full min-w-0 sm:w-64">
            <DsNativeSelect
              v-model="bulkAction"
              name="action"
              required
              aria-label="Tindakan"
              data-testid="questions-bulk-action"
            >
              <option value="">Pilih Tindakan</option>
              <option v-for="o in BULK_OPTIONS" :key="o.value" :value="o.value">
                {{ o.label }}
              </option>
            </DsNativeSelect>
          </div>
          <UButton
            type="submit"
            class="min-h-11"
            :disabled="busy"
            data-testid="questions-bulk-submit"
          >
            Laksanakan
          </UButton>
        </form>
      </DsPanel>

      <DsDataTable
        v-model:selection="selected"
        variant="flush"
        :layout="xl ? 'fixed' : 'auto'"
        selectable
        row-key="id"
        :data="tableRows"
        :columns="columns"
        caption="Senarai soalan"
        :loading="firstLoad"
        :total="list.data.value?.meta.totalItems ?? 0"
        :page-size="list.data.value?.meta.pageSize ?? perPage"
        :page-size-options="PAGE_SIZES"
        :page="list.data.value?.meta.page ?? page"
        card-title="excerptText"
        :card-fields="cardFields"
        empty-title="Tiada soalan dijumpai"
        :filtered="activeCount > 0"
        data-testid="questions-table"
        @update:page="goToPage"
        @update:page-size="setPageSize"
      >
        <template #id-cell="{ row }">
          <span class="text-label text-dimmed" data-testid="question-id">{{ row.original.id }}</span>
        </template>
        <template #excerptText-cell="{ row }">
          <div class="flex min-w-0 flex-col gap-2">
            <p class="line-clamp-2 break-words text-highlighted" data-testid="question-text">
              {{ row.original.excerptText }}
            </p>
            <div class="flex flex-wrap items-center gap-x-2 gap-y-2">
              <UBadge
                v-if="row.original.raw.dskpTagged"
                color="success"
                variant="subtle"
                size="sm"
                icon="i-ph-check-circle"
                label="DSKP"
                data-testid="question-dskp"
              />
              <UBadge
                v-else
                color="neutral"
                variant="subtle"
                size="sm"
                icon="i-ph-book-open"
                label="Latihan Tambahan"
                data-testid="question-dskp"
              />
              <UBadge
                :color="complianceColor(row.original.raw.complianceStatus)"
                variant="subtle"
                size="sm"
                :label="row.original.raw.complianceStatus.replaceAll('_', ' ').toUpperCase()"
                data-testid="question-compliance"
              />
              <UBadge
                v-if="row.original.raw.aiVerified"
                color="info"
                variant="subtle"
                size="sm"
                label="AI Verified"
                data-testid="question-ai-verified"
              />
            </div>
            <p
              class="truncate text-caption text-muted"
              :title="row.original.raw.sourceFile ?? undefined"
            >
              <span data-testid="question-source"
                >Source: {{ sourceLabel(row.original.raw.sourceType) }}</span
              >
              <span v-if="row.original.raw.sourceFile" data-testid="question-source-file">
                · {{ row.original.raw.sourceFile }}</span
              >
            </p>
          </div>
        </template>
        <template #subjectName-cell="{ row }">
          <div class="flex min-w-0 flex-col">
            <span class="text-highlighted">{{ row.original.subjectName }}</span>
            <span class="text-caption text-muted 2xl:hidden">{{ row.original.levelName }}</span>
          </div>
        </template>
        <template #difficulty-cell="{ row }">
          <span
            class="inline-flex items-center gap-2 whitespace-nowrap"
            data-testid="question-stars"
            :aria-label="`Kesukaran ${row.original.raw.difficultyLevel} daripada 5`"
            :title="DIFFICULTY_LABELS[row.original.raw.difficultyLevel]"
          >
            <span class="inline-flex gap-1">
              <UIcon
                v-for="n in 5"
                :key="n"
                :name="n <= row.original.raw.difficultyLevel ? 'i-ph-star-fill' : 'i-ph-star'"
                class="size-4"
                :class="n <= row.original.raw.difficultyLevel ? 'text-warning' : 'text-muted'"
                :data-filled="n <= row.original.raw.difficultyLevel ? 'true' : 'false'"
              />
            </span>
          </span>
        </template>
        <template #status-cell="{ row }">
          <div class="flex flex-col items-start gap-2">
            <DsStatusBadge
              :status="statusDs(row.original.raw.status)"
              :label="statusLabel(row.original.raw.status, true)"
              data-testid="question-status"
            />
            <!-- Live word: "ACTIVE" / "INACTIVE" under the status pill (discovery M04 S1). -->
            <DsStatusBadge
              size="sm"
              :status="row.original.raw.isActive ? 'active' : 'inactive'"
              :label="row.original.raw.isActive ? 'ACTIVE' : 'INACTIVE'"
              data-testid="question-active"
            />
          </div>
        </template>
        <template #actions-cell="{ row }">
          <DsRowActions :actions="rowActions(row.original.raw)" :inline="2" testid="question-more" />
        </template>
        <template #card-actions="{ row }">
          <DsRowActions
            :actions="rowActions((row as TableRow).raw)"
            :inline="0"
            testid="question-more"
          />
        </template>
      </DsDataTable>
    </div>
  </DsPage>
</template>
