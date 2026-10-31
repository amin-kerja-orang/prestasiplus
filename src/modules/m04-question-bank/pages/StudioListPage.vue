<script setup lang="ts">
/**
 * Studio list `/admin/studio` (R1-F03a, V2 admin.md A01, design S1.1): "Studio", "Bank soalan kanonikal - cipta, semak, terbit".
 * Four status tiles (Draft, Reviewed, Approved, Archived) that set the Status filter, the filters the API supports
 * (Subjek, Status, Cari; Tahun, Negeri, Kertas, Jenis wait for the API, UX-19), the table No. / Soalan / Kertas / Sumber / Status
 * at 25 per page (cards below `md`), and the row actions Pratonton, Edit or Edit sebagai draf, and Sembunyikan ("Arkibkan soalan
 * ini?"). Under each badge: "Dilihat murid di x/n" from the servability batch read. The URL is the state, as on the legacy list.
 * Studio talks to the real API only (D84).
 */
import type { TableColumn } from '@nuxt/ui'
import type { ServabilityReport } from '@pp/contract'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useApi, useFlash } from '@/composables'
import {
  DsBadge,
  DsCallout,
  DsDataTable,
  DsEmptyState,
  DsFilterBar,
  DsGrid,
  DsLoadError,
  DsNativeSelect,
  DsPage,
  DsPanel,
  DsRowActions,
  DsStatTile,
  useConfirm,
  type CardField,
  type RowAction,
} from '@/ds'

import { fetchSubjects } from '../api/lookups'
import {
  editAsDraft,
  EditAsDraftRefused,
  fetchGroup,
  fetchServabilityBatch,
  fetchStudioList,
  fetchStudioQuestion,
  moveQuestionStatus,
  STUDIO_UNAVAILABLE,
  studioAvailable,
  type StudioRow,
} from '../api/studio'
import StudioPreview from '../components/studio/StudioPreview.vue'
import { excerpt, sourceLabel } from '../lib/question-list'
import { pageOf, queryText } from '../lib/route-query'
import { hydrate, blankDraft, type StudioDraft } from '../lib/studio/draft'
import type { GroupView } from '../lib/studio/group-members'
import {
  ARCHIVE_DIALOG,
  archiveBody,
  canArchive,
  draftCreatedFlash,
  FLASH,
  REASON,
  servedCaption,
  STATUS_ORDER,
  statusBadge,
  statusTone,
} from '../lib/studio/status'
import { errorLines, LOAD_ERROR } from '../lib/ui-errors'

const STUDIO_PATH = '/admin/studio'
const CREATE_PATH = '/admin/studio/questions/create'
const editPath = (id: string): string => `${STUDIO_PATH}/questions/${id}/sunting`

const PAGE_SIZES = [25, 50, 100]
const DEFAULT_PAGE_SIZE = 25
const KEYS = ['subject_id', 'status', 'search'] as const
type Key = (typeof KEYS)[number]

const route = useRoute()
const router = useRouter()
const flash = useFlash()
const confirm = useConfirm()

const available = studioAvailable()

const applied = computed(() => {
  const out = {} as Record<Key, string>
  for (const k of KEYS) out[k] = queryText(route.query[k]).trim()
  return out
})
const page = computed(() => pageOf(route.query.page))
const perPage = computed(() => {
  const n = Number.parseInt(queryText(route.query.per_page), 10)
  return PAGE_SIZES.includes(n) ? n : DEFAULT_PAGE_SIZE
})
const activeCount = computed(() => KEYS.filter((k) => applied.value[k] !== '').length)

const draft = ref<Record<Key, string>>(Object.fromEntries(KEYS.map((k) => [k, queryText(route.query[k])])) as Record<Key, string>)
watch(
  () => KEYS.map((k) => route.query[k]),
  () => {
    for (const k of KEYS) draft.value[k] = queryText(route.query[k])
  },
)

const list = useApi(
  (signal) =>
    available
      ? fetchStudioList({
          subjectId: applied.value.subject_id || null,
          status: applied.value.status || null,
          search: applied.value.search || null,
          page: page.value,
          pageSize: perPage.value,
          signal,
        })
      : Promise.resolve(null),
  [...KEYS.map((k) => () => route.query[k]), () => route.query.page, () => route.query.per_page],
)
const subjects = useApi((signal) => (available ? fetchSubjects({ signal }) : Promise.resolve(null)))

const rows = computed<StudioRow[]>(() => list.data.value?.data ?? [])
const firstLoad = computed(() => available && list.data.value === null && list.error.value === null)
const subjectOptions = computed(() => subjects.data.value?.data ?? [])
const counts = computed(() => list.data.value?.meta.counts)

/** "Dilihat murid di x/n" per row of this page (one batch read, at most 100 ids). */
const reports = ref<Record<string, ServabilityReport>>({})
watch(
  rows,
  async (now) => {
    reports.value = {}
    if (now.length === 0) return
    try {
      const res = await fetchServabilityBatch(now.map((r) => r.id))
      reports.value = Object.fromEntries(res.reports.map((r) => [r.questionId, r]))
    } catch {
      reports.value = {}
    }
  },
  { immediate: true },
)

const pagerQuery = computed(() => {
  const out: Record<string, string> = {}
  for (const k of KEYS) if (applied.value[k] !== '') out[k] = applied.value[k]
  if (perPage.value !== DEFAULT_PAGE_SIZE) out.per_page = String(perPage.value)
  return out
})

const chips = computed(() => {
  const out: { key: string; label: string }[] = []
  if (applied.value.subject_id !== '') {
    const s = subjectOptions.value.find((o) => String(o.id) === applied.value.subject_id)
    out.push({ key: 'subject_id', label: `Subjek: ${s?.name ?? applied.value.subject_id}` })
  }
  if (applied.value.status !== '') out.push({ key: 'status', label: `Status: ${statusBadge(applied.value.status)}` })
  if (applied.value.search !== '') out.push({ key: 'search', label: `Cari: ${applied.value.search}` })
  return out
})

async function submitFilter(): Promise<void> {
  const query: Record<string, string> = {}
  for (const k of KEYS) if (draft.value[k].trim() !== '') query[k] = draft.value[k].trim()
  if (perPage.value !== DEFAULT_PAGE_SIZE) query.per_page = String(perPage.value)
  if (JSON.stringify(query) === JSON.stringify(pagerQuery.value) && !route.query.page) await list.reload()
  else await router.push({ path: STUDIO_PATH, query })
}
async function resetFilter(): Promise<void> {
  for (const k of KEYS) draft.value[k] = ''
  await router.push({ path: STUDIO_PATH, ...(perPage.value !== DEFAULT_PAGE_SIZE ? { query: { per_page: String(perPage.value) } } : {}) })
}
function removeChip(key: string): void {
  const query = { ...pagerQuery.value }
  Reflect.deleteProperty(query, key)
  void router.push({ path: STUDIO_PATH, query })
}
function goToPage(next: number): void {
  void router.push({ path: STUDIO_PATH, query: { ...pagerQuery.value, page: String(next) } })
}
function setPageSize(size: number): void {
  const query = { ...pagerQuery.value }
  Reflect.deleteProperty(query, 'per_page')
  if (size !== DEFAULT_PAGE_SIZE) query.per_page = String(size)
  void router.push({ path: STUDIO_PATH, query })
}
const tileTo = (status: string): { path: string; query: Record<string, string> } => {
  const query = { ...pagerQuery.value, status }
  Reflect.deleteProperty(query, 'per_page')
  return { path: STUDIO_PATH, query }
}

/* ---- row actions ---------------------------------------------------------------------------------- */

const busy = ref<string | null>(null)

async function hide(row: StudioRow): Promise<void> {
  if (busy.value !== null) return
  const served = reports.value[row.id]?.servedCount ?? null
  const ok = await confirm({
    title: ARCHIVE_DIALOG.title,
    message: archiveBody(served),
    confirmLabel: ARCHIVE_DIALOG.confirm,
    cancelLabel: ARCHIVE_DIALOG.cancel,
    tone: 'error',
  })
  if (!ok) return
  busy.value = row.id
  try {
    await moveQuestionStatus(row.id, 'archived', REASON.archive)
    flash.show({ type: 'success', message: FLASH.archived })
    await list.reload()
  } catch (err) {
    flash.show({ type: 'error', message: errorLines(err) })
  } finally {
    busy.value = null
  }
}

async function makeDraft(row: StudioRow): Promise<void> {
  if (busy.value !== null) return
  busy.value = row.id
  try {
    const id = await editAsDraft(row.id)
    flash.success(draftCreatedFlash(id))
    await router.push(editPath(id))
  } catch (err) {
    flash.show({ type: 'error', message: err instanceof EditAsDraftRefused ? err.lines : errorLines(err) })
  } finally {
    busy.value = null
  }
}

const previewOpen = ref(false)
const previewDraft = ref<StudioDraft>(blankDraft())
const previewGroup = ref<GroupView | null>(null)
const previewId = ref<string | null>(null)

async function preview(row: StudioRow): Promise<void> {
  if (busy.value !== null) return
  busy.value = row.id
  try {
    const q = await fetchStudioQuestion(row.id)
    const h = hydrate(q)
    previewDraft.value = h.draft
    previewId.value = row.id
    previewGroup.value = null
    if (h.draft.groupId !== null) {
      const g = await fetchGroup(h.draft.groupId)
      previewGroup.value = {
        id: g.id,
        stimuli: g.stimuli,
        members: [{ id: row.id, numberLabel: h.draft.numberLabel, stem: h.draft.stem }],
        locked: false,
        warning: g.warning ?? null,
      }
    }
    previewOpen.value = true
  } catch (err) {
    flash.show({ type: 'error', message: errorLines(err) })
  } finally {
    busy.value = null
  }
}

function rowActions(row: StudioRow): RowAction[] {
  const out: RowAction[] = [
    { label: 'Pratonton', icon: 'i-ph-eye', onSelect: () => void preview(row), disabled: busy.value !== null, testid: 'studio-row-preview' },
  ]
  if (row.status === 'approved') {
    out.push({ label: 'Edit sebagai draf', icon: 'i-ph-pencil-simple', onSelect: () => void makeDraft(row), loading: busy.value === row.id, disabled: busy.value !== null, testid: 'studio-row-edit-draft' })
  } else {
    out.push({ label: 'Edit', icon: 'i-ph-pencil-simple', to: editPath(row.id), testid: 'studio-row-edit' })
  }
  if (canArchive(row.status)) {
    out.push({ label: 'Sembunyikan', icon: 'i-ph-eye-slash', disabled: busy.value !== null, onSelect: () => void hide(row), testid: 'studio-row-hide' })
  }
  return out
}

/* ---- table ---------------------------------------------------------------------------------------- */

interface TableRow extends Record<string, unknown> {
  id: string
  stem: string
  kertas: string
  sumber: string
  statusText: string
  raw: StudioRow
}
const tableRows = computed<TableRow[]>(() =>
  rows.value.map((r) => ({
    id: r.id,
    stem: excerpt(r.questionText),
    kertas: [r.subject?.name, r.level?.name].filter(Boolean).join(' · ') || '-',
    sumber: sourceLabel(r.sourceType),
    statusText: statusBadge(r.status),
    raw: r,
  })),
)

const META_CLASS = 'class'
const cellClass = (th: string, td = th): { meta: Record<string, unknown> } => ({ meta: { [META_CLASS]: { th, td } } })
const columns: TableColumn<TableRow>[] = [
  { accessorKey: 'id', header: 'No.', ...cellClass('w-16') },
  { accessorKey: 'stem', header: 'Soalan', ...cellClass('min-w-64') },
  { accessorKey: 'kertas', header: 'Kertas', ...cellClass('hidden lg:table-cell w-48') },
  { accessorKey: 'sumber', header: 'Sumber', ...cellClass('hidden lg:table-cell w-32') },
  { id: 'status', header: 'Status', ...cellClass('w-40') },
  { id: 'actions', header: ' ', ...cellClass('w-40 text-end', 'w-40') },
]
const cardFields: CardField[] = [
  { key: 'kertas', label: 'Kertas' },
  { key: 'sumber', label: 'Sumber' },
  { key: 'statusText', label: 'Status' },
]
</script>

<template>
  <DsPage subtitle="Bank soalan kanonikal - cipta, semak, terbit" data-testid="studio-list-page">
    <template #actions>
      <UButton :to="CREATE_PATH" icon="i-ph-plus" class="min-h-11 shrink-0" data-testid="studio-create">Cipta baharu</UButton>
    </template>

    <DsCallout v-if="!available" tone="info" data-testid="studio-unavailable">{{ STUDIO_UNAVAILABLE }}</DsCallout>

    <template v-else>
      <DsGrid :cols="{ base: 2, md: 4 }" gap="md" data-testid="studio-tiles">
        <DsStatTile
          v-for="s in STATUS_ORDER"
          :key="s"
          :value="counts?.[s] ?? null"
          :unit="statusBadge(s)"
          :selected="applied.status === s"
          :loading="firstLoad"
          :to="tileTo(s)"
          :part-prefix="`studio-tile-${s}`"
        />
      </DsGrid>

      <DsFilterBar
        :active-count="activeCount"
        :chips="chips"
        apply-label="Tapis"
        reset-label="Set Semula"
        data-testid="studio-filter"
        @apply="submitFilter"
        @reset="resetFilter"
        @remove-chip="removeChip"
      >
        <template #search>
          <div class="min-w-0 grow sm:basis-40">
            <UInput v-model="draft.search" type="text" name="search" placeholder="Cari soalan..." aria-label="Cari" icon="i-ph-magnifying-glass" class="w-full" data-testid="studio-search" />
          </div>
        </template>
        <div class="w-full min-w-0 md:w-48">
          <DsNativeSelect id="studio-subject" v-model="draft.subject_id" name="subject_id" aria-label="Subjek" data-testid="studio-subject-filter">
            <option value="">Semua subjek</option>
            <option v-for="s in subjectOptions" :key="s.id" :value="String(s.id)">{{ s.name }}</option>
          </DsNativeSelect>
        </div>
        <div class="w-full min-w-0 md:w-48">
          <DsNativeSelect id="studio-status-filter" v-model="draft.status" name="status" aria-label="Status" data-testid="studio-status-filter">
            <option value="">Semua status</option>
            <option v-for="s in STATUS_ORDER" :key="s" :value="s">{{ statusBadge(s) }}</option>
          </DsNativeSelect>
        </div>
      </DsFilterBar>

      <DsLoadError v-if="list.error.value" :message="LOAD_ERROR" testid="studio-error" retry-testid="studio-retry" @retry="list.reload()" />

      <DsPanel v-else-if="!firstLoad && rows.length === 0" data-testid="studio-empty">
        <DsEmptyState :title="activeCount > 0 ? 'Tiada soalan dijumpai.' : 'Belum ada soalan.'" icon="tray" :filtered="activeCount > 0">
          <template #actions>
            <UButton v-if="activeCount > 0" variant="link" data-testid="studio-empty-reset" @click="resetFilter">Set Semula</UButton>
            <UButton v-else :to="CREATE_PATH" variant="link" icon="i-ph-plus" data-testid="studio-empty-create">Cipta baharu</UButton>
          </template>
        </DsEmptyState>
      </DsPanel>

      <DsDataTable
        v-else
        variant="flush"
                row-key="id"
        :data="tableRows"
        :columns="columns"
        caption="Senarai soalan Studio"
        :loading="firstLoad"
        :total="list.data.value?.meta.totalItems ?? 0"
        :page-size="list.data.value?.meta.pageSize ?? perPage"
        :page-size-options="PAGE_SIZES"
        :page="list.data.value?.meta.page ?? page"
        card-title="stem"
        :card-fields="cardFields"
        empty-title="Tiada soalan dijumpai."
        :filtered="activeCount > 0"
        data-testid="studio-table"
        @update:page="goToPage"
        @update:page-size="setPageSize"
      >
        <template #id-cell="{ row }">
          <span class="text-label text-dimmed" data-testid="studio-row-id">{{ row.original.id }}</span>
        </template>
        <template #stem-cell="{ row }">
          <div class="flex min-w-0 flex-col gap-2">
            <p class="line-clamp-2 break-words text-highlighted" data-testid="studio-row-stem">{{ row.original.stem }}</p>
            <div class="flex flex-wrap items-center gap-2">
              <UBadge v-if="row.original.raw.dskpComplete === false" color="warning" variant="subtle" size="sm" label="Belum ditanda DSKP" data-testid="studio-row-dskp" />
              <span class="text-caption text-muted lg:hidden">{{ row.original.kertas }}</span>
            </div>
          </div>
        </template>
        <template #status-cell="{ row }">
          <div class="flex flex-col items-start gap-1">
            <DsBadge :label="row.original.statusText" :tone="statusTone(row.original.raw.status)" data-testid="studio-row-status" />
            <span v-if="reports[row.original.id]" class="text-caption text-muted" data-testid="studio-row-served">{{ servedCaption(reports[row.original.id]!) }}</span>
          </div>
        </template>
        <template #actions-cell="{ row }">
          <DsRowActions :actions="rowActions(row.original.raw)" :inline="3" testid="studio-row-more" />
        </template>
        <template #card-actions="{ row }">
          <DsRowActions :actions="rowActions((row as TableRow).raw)" :inline="3" testid="studio-row-more" />
        </template>
      </DsDataTable>
    </template>

    <StudioPreview v-model:open="previewOpen" :group="previewGroup" :draft="previewDraft" :question-id="previewId" />
  </DsPage>
</template>
