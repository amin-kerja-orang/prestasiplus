<script setup lang="ts">
/**
 * S5 `/admin/pksk/questions` "Soalan PKSK" (M07-T3; FR-M07-20..32), v2 staff theme.
 *
 * - Header row with "Tambah Soalan" and five global KPI tiles (#8), never affected by the filters.
 * - Filter bar: a change of any select navigates at once (page reset); "Cari" or Enter submits all four
 *   values; active-filter chips and "Set Semula". The query string is the state and the controls follow it.
 * - Table of 20 rows (#7); the pager keeps the filters. Below `md` every row is a card.
 * - Selection with a header checkbox (page ids), bulk bar "Luluskan" / "Tolak" (no confirm) and "Padam"
 *   (`useConfirm`), a row menu with "Edit" and "Padam". After a mutation the list reloads at the same URL
 *   with the flash and the stat tiles refresh (L-8, INFERRED).
 */
import type { TableColumn } from '@nuxt/ui'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useApi, useFlash } from '@/composables'
import {
  DsDataTable,
  DsEmptyState,
  DsFilterBar,
  DsLoadError,
  DsNativeSelect,
  DsPage,
  DsPanel,
  DsRowActions,
  DsStatRow,
  DsStatusBadge,
  useConfirm,
} from '@/ds'
import type { CardField, RowAction, StatItem } from '@/ds'

import {
  bulkPkskQuestions,
  deletePkskQuestion,
  fetchPkskQuestionStats,
  fetchPkskQuestions,
  type BulkAction,
  type PkskQuestionListItem,
} from '../api/admin'
import { cellClass } from '../lib/table-cols'
import {
  BAHAGIAN_FILTER_OPTIONS,
  COPY,
  LEVEL_FILTER_OPTIONS,
  QUESTIONS_PATH,
  QUESTION_CREATE_PATH,
  STATUS_BADGE,
  STATUS_LABEL,
  STATUS_OPTIONS,
  errorLines,
  limitQuestionText,
  matchOption,
  queryPage,
  queryText,
} from '../lib/admin'

const route = useRoute()
const router = useRouter()
const flash = useFlash()
const confirm = useConfirm()

/** The applied filters, read from the URL (raw values; the API compares case-insensitively). */
const applied = computed(() => ({
  bahagian: queryText(route.query.bahagian),
  level: queryText(route.query.level),
  status: queryText(route.query.status),
  search: queryText(route.query.search).trim(),
  page: queryPage(route.query.page),
}))

// Draft values of the controls; re-synced when the URL changes (back/forward, links).
const bahagian = ref('')
const level = ref('')
const status = ref('')
const search = ref('')
function syncControls(): void {
  bahagian.value = matchOption(queryText(route.query.bahagian), BAHAGIAN_FILTER_OPTIONS)
  level.value = matchOption(queryText(route.query.level), LEVEL_FILTER_OPTIONS)
  status.value = matchOption(queryText(route.query.status).toLowerCase(), STATUS_OPTIONS)
  search.value = queryText(route.query.search)
}
syncControls()
watch(() => route.query, syncControls)

const { data, error, reload } = useApi(
  (signal) =>
    fetchPkskQuestions(
      {
        bahagian: applied.value.bahagian,
        level: applied.value.level,
        status: applied.value.status,
        search: applied.value.search,
        page: applied.value.page,
      },
      { signal },
    ),
  [
    () => route.query.bahagian,
    () => route.query.level,
    () => route.query.status,
    () => route.query.search,
    () => route.query.page,
  ],
)
const { data: stats, reload: reloadStats } = useApi((signal) => fetchPkskQuestionStats({ signal }))

const rows = computed<PkskQuestionListItem[]>(() => data.value?.data ?? [])
const total = computed(() => data.value?.meta.totalItems ?? 0)
const firstLoad = computed(() => data.value === null && error.value === null)

/** Filters kept on every pager link. */
const pagerQuery = computed(() => {
  const out: Record<string, string> = {}
  const a = applied.value
  if (a.bahagian !== '') out.bahagian = a.bahagian
  if (a.level !== '') out.level = a.level
  if (a.status !== '') out.status = a.status
  if (a.search !== '') out.search = a.search
  return out
})

const chips = computed(() => {
  const out: { key: string; label: string }[] = []
  const a = applied.value
  const b = BAHAGIAN_FILTER_OPTIONS.find((o) => o.value.toLowerCase() === a.bahagian.toLowerCase())
  if (b) out.push({ key: 'bahagian', label: `Bahagian ${b.label}` })
  const l = LEVEL_FILTER_OPTIONS.find((o) => o.value.toLowerCase() === a.level.toLowerCase())
  if (l) out.push({ key: 'level', label: l.label })
  const s = STATUS_OPTIONS.find((o) => o.value === a.status.toLowerCase())
  if (s) out.push({ key: 'status', label: s.label })
  if (a.search !== '') out.push({ key: 'search', label: `"${a.search}"` })
  return out
})

function formQuery(): Record<string, string> {
  const out: Record<string, string> = {}
  if (bahagian.value !== '') out.bahagian = bahagian.value
  if (level.value !== '') out.level = level.value
  if (status.value !== '') out.status = status.value
  const s = search.value.trim()
  if (s !== '') out.search = s
  return out
}

async function submitFilter(): Promise<void> {
  const query = formQuery()
  // Submitting the same filter reloads the page, as a live GET form does.
  if (JSON.stringify(query) === JSON.stringify(pagerQuery.value) && !route.query.page) {
    await reload()
  } else {
    await router.push({ path: QUESTIONS_PATH, query })
  }
}

async function resetFilter(): Promise<void> {
  await router.push({ path: QUESTIONS_PATH })
}

async function removeChip(key: string): Promise<void> {
  const query = { ...pagerQuery.value }
  delete query[key]
  await router.push({ path: QUESTIONS_PATH, query })
}

function goToPage(page: number): void {
  void router.push({ path: QUESTIONS_PATH, query: { ...pagerQuery.value, page: String(page) } })
}

// --- selection (FR-M07-28) --------------------------------------------------------------------

const selection = ref<TableRow[]>([])
const selectedIds = computed(() => selection.value.map((r) => r.id))

function clearSelection(): void {
  selection.value = []
}
// A new page of rows starts with no selection (the live page reloads).
watch(data, clearSelection)

// --- mutations (FR-M07-29..32) ----------------------------------------------------------------

const busy = ref(false)

/** Reloads the list (stepping back one page when the page became empty) and the stat cards. */
async function afterMutation(message: string): Promise<void> {
  clearSelection()
  await Promise.all([reload(), reloadStats()])
  if (rows.value.length === 0 && applied.value.page > 1) {
    await router.push({
      path: QUESTIONS_PATH,
      query: { ...pagerQuery.value, page: String(applied.value.page - 1) },
    })
  }
  flash.show({ type: 'success', message })
}

async function bulk(action: BulkAction): Promise<void> {
  if (busy.value || selectedIds.value.length === 0) return
  if (action === 'delete' && !(await confirm({ message: COPY.confirmBulkDelete, tone: 'error' })))
    return
  busy.value = true
  try {
    const result = await bulkPkskQuestions(action, [...selectedIds.value])
    await afterMutation(result.status)
  } catch (err) {
    flash.show({ type: 'error', message: errorLines(err) })
  } finally {
    busy.value = false
  }
}

async function remove(row: PkskQuestionListItem): Promise<void> {
  if (busy.value) return
  if (!(await confirm({ message: COPY.confirmDelete, tone: 'error' }))) return
  busy.value = true
  try {
    await deletePkskQuestion(row.id)
    await afterMutation(COPY.questionDeleted)
  } catch (err) {
    flash.show({ type: 'error', message: errorLines(err) })
  } finally {
    busy.value = false
  }
}

function actionsOf(row: PkskQuestionListItem): RowAction[] {
  return [
    { label: 'Edit', icon: 'i-ph-pencil-simple', to: `${QUESTIONS_PATH}/${String(row.id)}/edit` },
    {
      label: 'Padam',
      icon: 'i-ph-trash',
      danger: true,
      disabled: busy.value,
      onSelect: () => void remove(row),
    },
  ]
}

const BAHAGIAN_COLOR = { A: 'secondary', B: 'info', C: 'warning' } as const
const LEVEL_COLOR = { T1: 'primary', T4: 'neutral' } as const

const bahagianColor = (b: PkskQuestionListItem['bahagian']) => BAHAGIAN_COLOR[b]
const levelColor = (l: PkskQuestionListItem['targetLevel']) => LEVEL_COLOR[l]

const statItems = computed<StatItem[]>(() => {
  const s = stats.value
  if (!s) return []
  return [
    { key: 'total', label: 'Jumlah', value: s.total, icon: 'stack', accent: 'action' },
    {
      key: 'approved',
      label: 'Diluluskan',
      value: s.approved,
      icon: 'check-circle',
      accent: 'win',
    },
    { key: 'pending', label: 'Menunggu', value: s.pending, icon: 'hourglass', accent: 'heat' },
    { key: 't1', label: 'Ting. 1', value: s.t1, icon: 'number-one', accent: 'friend' },
    { key: 't4', label: 'Ting. 4', value: s.t4, icon: 'number-four', accent: 'trial' },
  ]
})

interface TableRow extends Record<string, unknown> {
  id: number
  text: string
  bahagian: string
  domainName: string
  targetLevel: string
  raw: PkskQuestionListItem
}

const tableRows = computed<TableRow[]>(() =>
  rows.value.map((r) => ({
    id: r.id,
    text: limitQuestionText(r.questionText),
    bahagian: r.bahagian,
    domainName: r.domain.name,
    targetLevel: r.targetLevel,
    raw: r,
  })),
)

const columns: TableColumn<TableRow>[] = [
  { accessorKey: 'text', header: 'Soalan', ...cellClass('') },
  { accessorKey: 'bahagian', header: 'Bahagian', ...cellClass('w-24') },
  { accessorKey: 'domainName', header: 'Domain', ...cellClass('w-44') },
  { accessorKey: 'targetLevel', header: 'Tahap', ...cellClass('w-24') },
  { id: 'status', header: 'Status', ...cellClass('w-36') },
  { id: 'actions', header: 'Tindakan', ...cellClass('w-48') },
]
const cardFields: CardField[] = [
  { key: 'bahagian', label: 'Bahagian' },
  { key: 'domainName', label: 'Domain' },
  { key: 'targetLevel', label: 'Tahap' },
]
</script>

<template>
  <DsPage data-testid="pksk-questions-page">
    <template #subtitle>{{ total }} soalan sepadan dengan penapis semasa</template>
    <template #actions>
      <UButton
        :to="QUESTION_CREATE_PATH"
        icon="i-ph-plus"
        label="Tambah Soalan"
        class="min-h-11"
        data-testid="pksk-add"
      />
    </template>

    <!-- Five global stat tiles (#8). -->
    <DsStatRow v-if="stats" :items="statItems" prefix="stat" :cols="5" data-testid="pksk-stats" />

    <DsFilterBar
      :chips="chips"
      data-testid="pksk-filter"
      @apply="submitFilter"
      @reset="resetFilter"
      @remove-chip="removeChip"
    >
      <template #search>
        <UInput
          v-model="search"
          type="text"
          name="search"
          aria-label="Cari"
          placeholder="Cari soalan..."
          icon="i-ph-magnifying-glass"
          class="w-full md:min-w-64 md:grow"
          data-testid="filter-search"
        />
      </template>
      <DsNativeSelect
        v-model="bahagian"
        name="bahagian"
        aria-label="Bahagian"
        placeholder="Semua Bahagian"
        :items="BAHAGIAN_FILTER_OPTIONS"
        class="md:w-48"
        data-testid="filter-bahagian"
        @change="submitFilter"
      />
      <DsNativeSelect
        v-model="level"
        name="level"
        aria-label="Tahap"
        placeholder="Semua Tahap"
        :items="LEVEL_FILTER_OPTIONS"
        class="md:w-44"
        data-testid="filter-level"
        @change="submitFilter"
      />
      <DsNativeSelect
        v-model="status"
        name="status"
        aria-label="Status"
        placeholder="Semua Status"
        :items="STATUS_OPTIONS"
        class="md:w-44"
        data-testid="filter-status"
        @change="submitFilter"
      />
    </DsFilterBar>

    <DsLoadError
      v-if="error"
      :message="errorLines(error).join(' ')"
      testid="pksk-questions-error"
      @retry="reload()"
    />

    <DsPanel v-else-if="!firstLoad && rows.length === 0" data-testid="pksk-questions-empty">
      <DsEmptyState :title="COPY.questionsEmpty" icon="tray">
        <template #actions>
          <UButton
            :to="QUESTION_CREATE_PATH"
            variant="link"
            icon="i-ph-plus"
            class="min-h-11"
            data-testid="pksk-empty-add"
            :label="COPY.questionsEmptyLink"
          />
        </template>
      </DsEmptyState>
    </DsPanel>

    <div v-else class="flex flex-col gap-4">
      <!-- Bulk bar: only while at least one row is ticked. -->
      <DsPanel v-if="selectedIds.length > 0" behavior="bulk" data-testid="pksk-bulk-bar">
        <div class="flex flex-wrap items-center gap-3">
          <span class="inline-flex items-center gap-2 text-label text-highlighted">
            <UIcon name="i-ph-check-square" class="size-5 text-primary-t" aria-hidden="true" />
            <span class="tabular" data-testid="bulk-count">{{ selectedIds.length }} dipilih</span>
          </span>
          <UButton
            type="button"
            color="success"
            variant="soft"
            icon="i-ph-check"
            label="Luluskan"
            class="min-h-11"
            :disabled="busy"
            data-testid="bulk-approve"
            @click="bulk('approve')"
          />
          <UButton
            type="button"
            color="warning"
            variant="soft"
            icon="i-ph-x"
            label="Tolak"
            class="min-h-11"
            :disabled="busy"
            data-testid="bulk-reject"
            @click="bulk('reject')"
          />
          <UButton
            type="button"
            color="error"
            variant="soft"
            icon="i-ph-trash"
            label="Padam"
            class="min-h-11"
            :disabled="busy"
            data-testid="bulk-delete"
            @click="bulk('delete')"
          />
        </div>
      </DsPanel>

      <DsDataTable
        v-model:selection="selection"
        variant="flush"
        layout="fixed"
        min-width="60rem"
        selectable
        row-key="id"
        :data="tableRows"
        :columns="columns"
        caption="Senarai soalan PKSK"
        :loading="firstLoad"
        :total="total"
        :page-size="data?.meta.pageSize ?? 20"
        :page="applied.page"
        :filtered="chips.length > 0"
        card-title="text"
        :card-fields="cardFields"
        :empty-title="COPY.questionsEmpty"
        data-testid="pksk-questions-table"
        @update:page="goToPage"
      >
        <template #text-cell="{ row }">
          <p
            class="line-clamp-2 min-w-0 break-words text-body text-highlighted"
            data-testid="pksk-question-row"
            :data-question-id="row.original.id"
          >
            <span data-testid="q-text">{{ row.original.text }}</span>
          </p>
        </template>
        <template #bahagian-cell="{ row }">
          <UBadge
            :color="bahagianColor(row.original.raw.bahagian)"
            variant="subtle"
            :label="row.original.bahagian"
            data-testid="q-bahagian"
          />
        </template>
        <template #domainName-cell="{ row }">
          <span class="inline-flex items-center gap-2" data-testid="q-domain">
            <UIcon name="i-ph-shapes" class="size-4 shrink-0 text-muted" aria-hidden="true" />
            {{ row.original.domainName }}
          </span>
        </template>
        <template #targetLevel-cell="{ row }">
          <UBadge
            :color="levelColor(row.original.raw.targetLevel)"
            variant="subtle"
            :label="row.original.targetLevel"
            data-testid="q-level"
          />
        </template>
        <template #status-cell="{ row }">
          <DsStatusBadge
            :status="STATUS_BADGE[row.original.raw.status]"
            :label="STATUS_LABEL[row.original.raw.status]"
            data-testid="q-status"
          />
        </template>
        <template #actions-cell="{ row }">
          <DsRowActions :actions="actionsOf(row.original.raw)" :inline="1" />
        </template>
        <template #card-actions="{ row }">
          <DsRowActions :actions="actionsOf((row as unknown as TableRow).raw)" />
        </template>
      </DsDataTable>
    </div>
  </DsPage>
</template>
