<script setup lang="ts">
/**
 * S1 `/admin/questions` "Pengurusan Soalan" (M04-T3; FR-M04-01..16). v2: Portal Pentadbiran staff theme.
 *
 * Admin-list pattern (docs/design/v2-admin-pages.md):
 * - a compact header row with the create button, a KPI strip + collapsible subject table;
 * - one filter toolbar (search, 4 selects, a "Lagi penapis" popover, a drawer below `md`, chips of the
 *   active filters; the URL is the state);
 * - the dense table (bulk select, row menu) and the server pager with a page-size select.
 * - Bulk bar: the action select is `required`; confirmation through `useConfirm`; the API `status` is the flash.
 * - The table fits the width from `xl`; below that Tahap folds into Subjek; below `md` rows are cards.
 */
import type { DropdownMenuItem, TableColumn } from '@nuxt/ui'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useApi, useFlash } from '@/composables'
import { DsDataTable, DsEmptyState, DsPage, DsPanel, useConfirm, type CardField } from '@/ds'
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
import ErrorBox from '../components/ErrorBox.vue'
import NativeSelect from '../components/native/NativeSelect.vue'
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
const wide = useMedia('(min-width: 768px)')

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

// --- Filter fields: one definition drives the toolbar, the popover, the drawer and the chips.
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
  const out: { key: FilterKey; text: string }[] = []
  for (const f of ALL_FIELDS.value) {
    const v = applied.value[f.key]
    if (v === '') continue
    const label = f.options.find((o) => o.value === v)?.label ?? v
    out.push({ key: f.key, text: `${f.label}: ${label}` })
  }
  if (applied.value.search !== '') {
    out.push({ key: 'search', text: `Cari: ${applied.value.search}` })
  }
  return out
})

const sheet = ref(false)
const morePopover = ref(false)

async function submitFilter(): Promise<void> {
  sheet.value = false
  morePopover.value = false
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
  sheet.value = false
  morePopover.value = false
  for (const key of FILTER_KEYS) draft.value[key] = ''
  await router.push({
    path: QUESTIONS_LIST_PATH,
    ...(perPage.value !== DEFAULT_PAGE_SIZE ? { query: { per_page: String(perPage.value) } } : {}),
  })
}

function removeChip(key: FilterKey): void {
  draft.value[key] = ''
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

/** Row menu: Lihat and Edit stay one click away as icon buttons; the menu holds the destructive one. */
function rowMenu(row: QuestionRow): DropdownMenuItem[][] {
  return [
    [{ label: 'Lihat', icon: 'i-ph-eye', to: questionDetailPath(row.id) }],
    [{ label: 'Edit', icon: 'i-ph-pencil-simple', to: questionEditPath(row.id) }],
    [
      {
        label: 'Padam',
        icon: 'i-ph-trash',
        color: 'error',
        disabled: busy.value,
        onSelect: () => void remove(row),
      },
    ],
  ]
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
  { id: 'select', header: ' ', ...cellClass('w-12 pe-0', 'w-12 pe-0') },
  { accessorKey: 'id', header: 'ID', ...cellClass('w-16') },
  { accessorKey: 'excerptText', header: 'Soalan', ...cellClass('') },
  { accessorKey: 'subjectName', header: 'Subjek', ...cellClass('w-36 xl:w-40') },
  { accessorKey: 'levelName', header: 'Tahap', ...cellClass('hidden 2xl:table-cell w-40') },
  { id: 'difficulty', header: 'Kesukaran', ...cellClass('w-28') },
  { id: 'status', header: 'Status', ...cellClass('w-32') },
  { id: 'actions', header: ' ', ...cellClass('w-36 text-end', 'w-36') },
]
const cardFields: CardField[] = [
  { key: 'subjectName', label: 'Subjek' },
  { key: 'levelName', label: 'Tahap' },
  { key: 'statusText', label: 'Status' },
  { key: 'difficultyText', label: 'Kesukaran' },
]
</script>

<template>
  <DsPage data-testid="questions-page">
    <!-- Header row: what the page is for, the live total and the primary action. -->
    <div class="flex items-center justify-between gap-3">
      <p class="min-w-0 text-body text-muted">Urus bank soalan untuk platform PRESTASIPLUS</p>
      <UButton
        :to="QUESTIONS_CREATE_PATH"
        icon="i-ph-plus"
        class="shrink-0"
        data-testid="questions-add"
      >
        <span class="hidden sm:inline">Tambah Soalan</span>
        <span class="sm:hidden">Tambah</span>
      </UButton>
    </div>

    <QuestionSummaryCard :summary="summary.data.value" :active-subject-id="activeSubjectId" />

    <!-- Filter toolbar (the URL is the state). -->
    <div class="flex flex-col gap-3">
      <DsPanel>
      <form
        class="flex flex-wrap items-center gap-3"
        role="search"
        data-testid="questions-filter"
        @submit.prevent="submitFilter"
      >
        <div class="flex min-w-64 grow basis-80 items-center gap-2">
          <label for="q-search" class="sr-only">Cari</label>
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
          <UButton type="submit" icon="i-ph-magnifying-glass" label="Cari" />
        </div>

        <template v-if="wide">
          <div v-for="f in PRIMARY_FIELDS" :key="f.key" class="w-40 min-w-0 2xl:w-52">
            <label :for="f.id" class="sr-only">{{ f.label }}</label>
            <NativeSelect
              :id="f.id"
              v-model="draft[f.key]"
              :name="f.key"
              :data-testid="f.testid"
            >
              <option value="">{{ f.empty }}</option>
              <option v-for="o in f.options" :key="o.value" :value="o.value">{{ o.label }}</option>
            </NativeSelect>
          </div>

          <UPopover v-model:open="morePopover" :content="{ align: 'end' }">
            <UChip :show="moreActive > 0" :text="moreActive" color="primary">
              <UButton
                type="button"
                color="neutral"
                variant="soft"
                icon="i-ph-sliders-horizontal"
                data-testid="questions-more-open"
                >Lagi penapis</UButton
              >
            </UChip>
            <template #content>
              <div class="flex w-72 flex-col gap-3 p-4" data-testid="questions-more">
                <div v-for="f in MORE_FIELDS" :key="f.key">
                  <label :for="f.id" class="mb-2 block text-label text-highlighted">{{
                    f.label
                  }}</label>
                  <NativeSelect
                    :id="f.id"
                    v-model="draft[f.key]"
                    :name="f.key"
                    :data-testid="f.testid"
                  >
                    <option value="">{{ f.empty }}</option>
                    <option v-for="o in f.options" :key="o.value" :value="o.value">
                      {{ o.label }}
                    </option>
                  </NativeSelect>
                </div>
                <UButton type="button" block label="Guna" @click="submitFilter" />
              </div>
            </template>
          </UPopover>

          <UButton
            v-if="activeCount > 0"
            type="button"
            color="neutral"
            variant="ghost"
            label="Set Semula"
            @click="resetFilter"
          />
        </template>

        <template v-else>
          <UChip :show="activeCount > 0" :text="activeCount" color="primary">
            <UButton
              type="button"
              color="neutral"
              variant="soft"
              icon="i-ph-funnel"
              label="Penapis"
              data-testid="questions-filter-open"
              @click="sheet = true"
            />
          </UChip>
          <UDrawer v-model:open="sheet" title="Penapis" description=" ">
            <template #body>
              <div
                class="flex flex-col gap-4 overflow-y-auto"
                data-testid="questions-filter-sheet"
              >
                <div v-for="f in ALL_FIELDS" :key="f.key">
                  <label :for="`m-${f.id}`" class="mb-2 block text-label text-highlighted">{{
                    f.label
                  }}</label>
                  <NativeSelect
                    :id="`m-${f.id}`"
                    v-model="draft[f.key]"
                    :name="f.key"
                    :data-testid="`m-${f.testid}`"
                  >
                    <option value="">{{ f.empty }}</option>
                    <option v-for="o in f.options" :key="o.value" :value="o.value">
                      {{ o.label }}
                    </option>
                  </NativeSelect>
                </div>
                <UButton type="button" block label="Guna" @click="submitFilter" />
                <UButton
                  type="button"
                  block
                  color="neutral"
                  variant="ghost"
                  label="Set Semula"
                  @click="resetFilter"
                />
              </div>
            </template>
          </UDrawer>
        </template>
      </form>
      </DsPanel>

      <div
        v-if="chips.length > 0"
        class="flex flex-wrap items-center gap-2"
        data-testid="questions-chips"
      >
        <span class="text-label text-muted">Penapis aktif:</span>
        <UButton
          v-for="c in chips"
          :key="c.key"
          type="button"
          color="neutral"
          variant="soft"
          size="sm"
          trailing-icon="i-ph-x"
          :aria-label="`Buang penapis ${c.text}`"
          data-testid="questions-chip"
          @click="removeChip(c.key)"
          >{{ c.text }}</UButton
        >
      </div>
    </div>

    <!-- Load failure: alert in place of the table + retry (INFERRED copy, SRS §8.2). -->
    <div v-if="list.error.value" class="flex flex-col gap-3" data-testid="questions-error">
      <ErrorBox :messages="LOAD_ERROR" />
      <div>
        <UButton type="button" data-testid="questions-retry" @click="list.reload()">
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
            data-testid="questions-empty-add"
            >Tambah Soalan Pertama</UButton
          >
        </template>
      </DsEmptyState>
    </UCard>

    <div v-else class="flex flex-col gap-3">
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
        <UButton type="submit" :disabled="busy" data-testid="questions-bulk-submit">
          Laksanakan
        </UButton>
      </form>
      </DsPanel>

      <DsDataTable
        dense
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
        empty-label="Tiada soalan dijumpai"
        data-testid="questions-table"
        @update:page="goToPage"
        @update:page-size="setPageSize"
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
          <div class="flex items-center justify-end gap-1">
            <UButton
              :to="questionDetailPath(row.original.id)"
              color="neutral"
              variant="ghost"
              icon="i-ph-eye"
              aria-label="Lihat"
              title="Lihat"
              data-testid="question-view"
            />
            <UButton
              :to="questionEditPath(row.original.id)"
              color="neutral"
              variant="ghost"
              icon="i-ph-pencil-simple"
              aria-label="Edit"
              title="Edit"
              data-testid="question-edit"
            />
            <UDropdownMenu :items="rowMenu(row.original.raw)" :content="{ align: 'end' }">
              <UButton
                type="button"
                color="neutral"
                variant="ghost"
                icon="i-ph-dots-three-vertical"
                aria-label="Lagi tindakan"
                title="Lagi tindakan"
                data-testid="question-more"
              />
            </UDropdownMenu>
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
            />
            <UDropdownMenu :items="rowMenu(row.raw as QuestionRow)" :content="{ align: 'end' }">
              <UButton
                type="button"
                color="neutral"
                variant="soft"
                icon="i-ph-dots-three-vertical"
                aria-label="Lagi tindakan"
              />
            </UDropdownMenu>
          </div>
        </template>
      </DsDataTable>
    </div>
  </DsPage>
</template>
