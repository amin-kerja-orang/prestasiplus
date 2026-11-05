<script setup lang="ts">
/**
 * Studio list `/admin/studio` (R1-F03a, V2 admin.md A01, design S1.1): "Studio", "Bank soalan kanonikal - cipta, semak, terbit".
 * Four status tiles (BM words Draf, Menunggu Semakan, Diterbitkan, Diarkibkan, UX-19) that set the Status filter, the filters (Subjek, Status, Cari and, on
 * the source paper, Tahun, Negeri, Kertas, Jenis: T47), the table No. / Soalan / Kertas / Sumber / Status
 * at 25 per page (cards below `md`), and the row actions Pratonton, Edit or Edit sebagai draf, and Sembunyikan ("Arkibkan soalan
 * ini?"). Under each badge: "Dilihat murid di x/n" from the servability batch read. The URL is the state, as on the legacy list.
 * Studio talks to the real API only (D84).
 */
import type { TableColumn } from '@nuxt/ui'
import type { ServabilityReport } from '@pp/contract'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useApi, useFlash } from '@/composables'
import {
  DsBadge,
  DsCallout,
  DsCluster,
  DsDataTable,
  DsDialog,
  DsEmptyState,
  DsFilterBar,
  DsFormField,
  DsGrid,
  DsLoadError,
  DsNativeSelect,
  DsPage,
  DsPanel,
  DsRowActions,
  DsStack,
  DsStatRow,
  DsStatTile,
  type StatItem,
  DsText,
  useConfirm,
  type CardField,
  type RowAction,
} from '@/ds'

import { useMedia } from '@/ds/useMedia'

import { fetchEducationLevels, fetchSubjects } from '../api/lookups'
import { fetchQuestionSummary, type QuestionBulkFilter } from '../api/questions'
import {
  createGroup,
  createStimulus,
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
import StudioBulkBar from '../components/studio/StudioBulkBar.vue'
import StudioPreview from '../components/studio/StudioPreview.vue'
import StudioStimulusEditor from '../components/studio/StudioStimulusEditor.vue'
import { excerpt, sourceLabel } from '../lib/question-list'
import { pageOf, queryText } from '../lib/route-query'
import { hydrate, blankDraft, type StudioDraft } from '../lib/studio/draft'
import { BANK_LETTERS, bankIssue, blankStimulus, stimulusIssue, toCreateBody, toOptionBank, type StimulusForm } from '../lib/studio/stimulus'
import type { GroupView } from '../lib/studio/group-members'
import {
  ARCHIVE_DIALOG,
  archiveBody,
  canArchive,
  draftCreatedFlash,
  FLASH,
  REASON,
  SERVED_TITLE,
  servedCaption,
  STATUS_ORDER,
  statusBadge,
  statusTone,
} from '../lib/studio/status'
import { listLoadMessage, useDebouncedFilter } from '../lib/list-load'
import { errorLines } from '../lib/ui-errors'

const STUDIO_PATH = '/admin/studio'
const CREATE_PATH = '/admin/studio/questions/create'
const editPath = (id: string): string => `${STUDIO_PATH}/questions/${id}/sunting`

/** Kertas 1 to 3 and the exam types of the source paper (V2 "Jenis"). */
const KERTAS_OPTIONS = ['1', '2', '3']
const JENIS_OPTIONS = [
  { value: 'sebenar', label: 'Sebenar' },
  { value: 'percubaan', label: 'Percubaan' },
  { value: 'modul', label: 'Modul' },
  { value: 'topikal', label: 'Topikal' },
  { value: 'latihan', label: 'Latihan' },
]
const PAGE_SIZES = [25, 50, 100]
const DEFAULT_PAGE_SIZE = 25
const KEYS = ['subject_id', 'status', 'search', 'tahun', 'negeri', 'kertas', 'jenis'] as const
type Key = (typeof KEYS)[number]

const route = useRoute()
const router = useRouter()
const flash = useFlash()
const confirm = useConfirm()

/** The columns fit the width from `lg`; below it the table drops Kertas and Sumber (the stem cell shows Kertas) and below `md` rows are cards. */
const lg = useMedia('(min-width: 1024px)')

const available = studioAvailable()

/** A value the API would refuse (422) is dropped from the URL state, so a hand-typed address cannot break the list. */
const validFilter = (k: Key, v: string): string => {
  if (k === 'tahun') return /^\d{4}$/.test(v) ? v : ''
  if (k === 'kertas') return KERTAS_OPTIONS.includes(v) ? v : ''
  if (k === 'jenis') return JENIS_OPTIONS.some((o) => o.value === v) ? v : ''
  if (k === 'negeri') return v.slice(0, 64)
  return v
}
const applied = computed(() => {
  const out = {} as Record<Key, string>
  for (const k of KEYS) out[k] = validFilter(k, queryText(route.query[k]).trim())
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
          tahun: applied.value.tahun || null,
          negeri: applied.value.negeri || null,
          kertas: applied.value.kertas || null,
          jenis: applied.value.jenis || null,
          page: page.value,
          pageSize: perPage.value,
          signal,
        })
      : Promise.resolve(null),
  [...KEYS.map((k) => () => route.query[k]), () => route.query.page, () => route.query.per_page],
)
const subjects = useApi((signal) => (available ? fetchSubjects({ signal }) : Promise.resolve(null)))

/**
 * FR-ADM-QE2.1: `Cipta baharu` offers `Soalan tunggal` and `Kumpulan rangsangan`. A group is always scoped and starts with its
 * first stimulus (API-Q-08 needs 1 to 3; decision 2 on #428), then opens on its own page.
 */
const startOpen = ref(false)
const startGroup = ref(false)
const groupForm = ref({ subjectId: '', educationLevelId: '', kertas: '' })
const groupStimulus = ref<StimulusForm>(blankStimulus())
/** `Bank pilihan (A-H)` (G-09): set here, as the group update route does not take it yet; empty = no bank. */
const groupBank = ref<string[]>([])
const groupErrors = ref<Record<string, string>>({})
const groupProblems = ref<string[]>([])
const groupBusy = ref(false)
const levels = useApi((signal) => (available ? fetchEducationLevels({ signal }) : Promise.resolve(null)))
const levelOptions = computed(() => levels.data.value?.data ?? [])

function openStart(): void {
  startGroup.value = false
  groupForm.value = { subjectId: '', educationLevelId: '', kertas: '' }
  groupStimulus.value = blankStimulus()
  groupBank.value = []
  groupErrors.value = {}
  groupProblems.value = []
  startOpen.value = true
}

async function createNewGroup(): Promise<void> {
  const f = groupForm.value
  const errors: Record<string, string> = {}
  if (f.subjectId === '') errors.subjectId = 'Sila pilih subjek.'
  if (f.educationLevelId === '') errors.educationLevelId = 'Sila pilih tahap pendidikan.'
  groupErrors.value = errors
  const issue = stimulusIssue(groupStimulus.value) ?? bankIssue(groupBank.value)
  groupProblems.value = issue === null ? [] : [issue]
  if (Object.keys(errors).length > 0 || issue !== null) return
  groupBusy.value = true
  try {
    const stim = await createStimulus(toCreateBody(groupStimulus.value))
    const g = await createGroup({
      label: groupStimulus.value.label.trim(),
      stimulusIds: [stim.data.id],
      subjectId: f.subjectId,
      educationLevelId: f.educationLevelId,
      kertas: f.kertas === '' ? null : f.kertas,
      ...(groupBank.value.length === 0 ? {} : { optionBank: toOptionBank(groupBank.value) }),
    })
    startOpen.value = false
    await router.push(`/admin/studio/groups/${g.data.id}`)
  } catch (err) {
    groupProblems.value = errorLines(err)
  } finally {
    groupBusy.value = false
  }
}

/** FR-ADM-Q03.5: rows picked for the bulk bar; the selection survives paging. */
const selected = ref<TableRow[]>([])
const selectedIds = computed(() => selected.value.map((r) => r.id))
/** The applied filter as the filter route takes it; the status filter is already the wire code here. */
const bulkFilter = computed<QuestionBulkFilter>(() => {
  const a = applied.value
  return Object.fromEntries(
    Object.entries({ subjectId: a.subject_id, status: a.status, search: a.search, tahun: a.tahun, negeri: a.negeri, kertas: a.kertas, jenis: a.jenis }).filter(([, v]) => v !== ''),
  )
})
async function afterBulk(): Promise<void> {
  selected.value = []
  await Promise.all([list.reload(), summary.reload()])
}

/** The KPI strip by Subjek (plan S2-T01, copied from `BankPage.vue`; data API-Q-01 `/summary`). A failed read just hides it. */
const summary = useApi((signal) => (available ? fetchQuestionSummary({ signal }) : Promise.resolve(null)))
const kpi = computed<StatItem[]>(() => {
  const s = summary.data.value
  if (!s) return []
  return [
    {
      key: 'total',
      label: 'Jumlah soalan',
      value: s.total,
      icon: 'books' as const,
      active: applied.value.subject_id === '',
      onClick: () => void router.push({ path: STUDIO_PATH, query: { ...pagerQuery.value, subject_id: undefined, page: undefined } }),
    },
    ...s.subjects
      .filter((x) => x.total > 0)
      .map((x) => ({
        key: String(x.id),
        label: x.name,
        value: x.approved,
        sub: `${String(x.approved)} Terbit`,
        icon: 'book-open' as const,
        active: applied.value.subject_id === String(x.id),
        onClick: () => void router.push({ path: STUDIO_PATH, query: { ...pagerQuery.value, subject_id: String(x.id), page: undefined } }),
      })),
  ]
})

const rows = computed<StudioRow[]>(() => list.data.value?.data ?? [])
const firstLoad = computed(() => available && list.data.value === null && list.error.value === null)
const subjectOptions = computed(() => subjects.data.value?.data ?? [])
const counts = computed(() => list.data.value?.meta.counts)

/** "Dilihat murid di x/n" per row of this page (one batch read, at most 100 ids). */
const reports = ref<Record<string, ServabilityReport>>({})
let batchSeq = 0
let batchAbort: AbortController | null = null
watch(
  rows,
  async (now) => {
    // A newer page (or filter) supersedes the read in flight: abort it and ignore a late answer.
    batchAbort?.abort()
    batchAbort = null
    const mine = (batchSeq += 1)
    reports.value = {}
    if (now.length === 0) return
    const ctl = new AbortController()
    batchAbort = ctl
    try {
      const res = await fetchServabilityBatch(now.map((r) => r.id), ctl.signal)
      if (mine !== batchSeq) return
      reports.value = Object.fromEntries(res.reports.map((r) => [r.questionId, r]))
    } catch {
      if (mine === batchSeq) reports.value = {}
    }
  },
  { immediate: true },
)
onBeforeUnmount(() => {
  batchSeq += 1
  batchAbort?.abort()
})

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
  if (applied.value.tahun !== '') out.push({ key: 'tahun', label: `Tahun: ${applied.value.tahun}` })
  if (applied.value.negeri !== '') out.push({ key: 'negeri', label: `Negeri: ${applied.value.negeri}` })
  if (applied.value.kertas !== '') out.push({ key: 'kertas', label: `Kertas: ${applied.value.kertas}` })
  if (applied.value.jenis !== '') out.push({ key: 'jenis', label: `Jenis: ${JENIS_OPTIONS.find((o) => o.value === applied.value.jenis)?.label ?? applied.value.jenis}` })
  return out
})

function draftQuery(): Record<string, string> {
  const query: Record<string, string> = {}
  for (const k of KEYS) {
    const v = validFilter(k, draft.value[k].trim())
    if (v !== '') query[k] = v
  }
  if (perPage.value !== DEFAULT_PAGE_SIZE) query.per_page = String(perPage.value)
  return query
}
/** REQ-A-027: typing or choosing applies the filter 300 ms later; a change that leaves the URL as it is reads nothing. */
const debounced = useDebouncedFilter(draft, KEYS, async () => {
  const query = draftQuery()
  if (JSON.stringify(query) !== JSON.stringify(pagerQuery.value)) await router.push({ path: STUDIO_PATH, query })
})
async function submitFilter(): Promise<void> {
  debounced.cancel()
  const query = draftQuery()
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
    await Promise.all([list.reload(), summary.reload()])
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
const previewUnsupported = ref<string[]>([])

async function preview(row: StudioRow): Promise<void> {
  if (busy.value !== null) return
  busy.value = row.id
  try {
    const q = await fetchStudioQuestion(row.id)
    const h = hydrate(q)
    previewDraft.value = h.draft
    previewUnsupported.value = h.unsupported
    previewId.value = row.id
    previewGroup.value = null
    if (h.draft.groupId !== null) {
      const g = await fetchGroup(h.draft.groupId)
      previewGroup.value = {
        id: g.id,
        stimuli: g.stimuli,
        members: [{ id: row.id, numberLabel: h.draft.numberLabel, stem: h.draft.stem }],
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
  /** "No.": the printed number label, else the question id. */
  no: string
  stem: string
  kertas: string
  sumber: string
  statusText: string
  /** "4/6" for the mobile card; the table shows the full caption under the badge. */
  served: string
  raw: StudioRow
}
const tableRows = computed<TableRow[]>(() =>
  rows.value.map((r) => ({
    id: r.id,
    no: r.numberLabel || r.id,
    stem: excerpt(r.questionText),
    kertas: r.kertas ? `Kertas ${r.kertas}` : [r.subject?.name, r.level?.name].filter(Boolean).join(' · ') || '-',
    sumber: sourceLabel(r.sourceType),
    statusText: statusBadge(r.status),
    served: reports.value[r.id] ? `${String(reports.value[r.id]!.servedCount)}/${String(reports.value[r.id]!.total)}` : '-',
    raw: r,
  })),
)

/**
 * Phone card (AC-ADM-R9): the full stem, clamped to 3 lines, with `Lihat penuh` when the text is longer than the clamp.
 * Whether it is clamped is measured on the rendered paragraph (the width decides), and only while it is collapsed.
 */
const expanded = ref<Set<string>>(new Set())
const clamped = ref<Record<string, boolean>>({})
function toggleStem(id: string): void {
  const next = new Set(expanded.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expanded.value = next
}
/** The rendered stem paragraphs by row id, so a width change (rotation) can measure them again. */
const stemEls = new Map<string, HTMLElement>()
function measure(id: string, el: HTMLElement): void {
  if (expanded.value.has(id)) return
  const over = el.scrollHeight > el.clientHeight + 1
  if (clamped.value[id] !== over) clamped.value = { ...clamped.value, [id]: over }
}
function measureStem(id: string, inst: unknown): void {
  const el = (inst as { $el?: unknown } | null)?.$el
  if (!(el instanceof HTMLElement)) {
    stemEls.delete(id)
    return
  }
  stemEls.set(id, el)
  measure(id, el)
}
const remeasure = (): void => stemEls.forEach((el, id) => measure(id, el))
onMounted(() => window.addEventListener('resize', remeasure))
onBeforeUnmount(() => window.removeEventListener('resize', remeasure))

const META_CLASS = 'class'
const cellClass = (th: string, td = th): { meta: Record<string, unknown> } => ({ meta: { [META_CLASS]: { th, td } } })
const columns: TableColumn<TableRow>[] = [
  { accessorKey: 'no', header: 'No.', ...cellClass('w-16') },
  { accessorKey: 'stem', header: 'Soalan', ...cellClass('min-w-48') },
  { accessorKey: 'kertas', header: 'Kertas', ...cellClass('hidden lg:table-cell w-40') },
  { accessorKey: 'sumber', header: 'Sumber', ...cellClass('hidden lg:table-cell w-24') },
  { id: 'status', header: 'Status', ...cellClass('w-36') },
  { id: 'actions', header: ' ', ...cellClass('w-36 text-end', 'w-36') },
]
const cardFields: CardField[] = [
  { key: 'kertas', label: 'Kertas' },
  { key: 'sumber', label: 'Sumber' },
  { key: 'statusText', label: 'Status' },
  { key: 'served', label: SERVED_TITLE },
]
</script>

<template>
  <DsPage subtitle="Bank soalan kanonikal - cipta, semak, terbit" data-testid="studio-list-page">
    <template #actions>
      <UButton type="button" icon="i-ph-plus" class="min-h-11 shrink-0" aria-haspopup="dialog" data-testid="studio-create" @click="openStart">Cipta baharu</UButton>
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

      <DsStatRow v-if="kpi.length > 0" :items="kpi" density="compact" aria-label="Ringkasan bank soalan" prefix="studio-kpi" data-testid="studio-kpis" />

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
        <div class="w-full min-w-0 md:w-28">
          <UInput v-model="draft.tahun" type="text" name="tahun" inputmode="numeric" maxlength="4" placeholder="Tahun" aria-label="Tahun" data-testid="studio-tahun-filter" />
        </div>
        <div class="w-full min-w-0 md:w-48">
          <UInput v-model="draft.negeri" type="text" name="negeri" maxlength="64" placeholder="Negeri / badan" aria-label="negeri atau badan peperiksaan" data-testid="studio-negeri-filter" />
        </div>
        <div class="w-full min-w-0 md:w-44">
          <DsNativeSelect id="studio-kertas-filter" v-model="draft.kertas" name="kertas" aria-label="Kertas" data-testid="studio-kertas-filter">
            <option value="">Semua kertas</option>
            <option v-for="k in KERTAS_OPTIONS" :key="k" :value="k">Kertas {{ k }}</option>
          </DsNativeSelect>
        </div>
        <div class="w-full min-w-0 md:w-40">
          <DsNativeSelect id="studio-jenis-filter" v-model="draft.jenis" name="jenis" aria-label="Jenis" data-testid="studio-jenis-filter">
            <option value="">Semua jenis</option>
            <option v-for="j in JENIS_OPTIONS" :key="j.value" :value="j.value">{{ j.label }}</option>
          </DsNativeSelect>
        </div>
      </DsFilterBar>

      <StudioBulkBar :selected-ids="selectedIds" :filter="bulkFilter" :matched="list.data.value?.meta.totalItems ?? 0" @done="afterBulk" />

      <DsLoadError v-if="list.error.value" :message="listLoadMessage(list.error.value)" testid="studio-error" retry-testid="studio-retry" @retry="list.reload()" />

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
        v-model:selection="selected"
        variant="flush"
        :layout="lg ? 'fixed' : 'auto'"
        row-key="id"
        selectable
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
        <template #no-cell="{ row }">
          <span class="text-label text-dimmed" data-testid="studio-row-id">{{ row.original.no }}</span>
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
        <template #card="{ row }">
          <DsStack gap="xs" align="start" data-testid="studio-card">
            <DsCluster gap="xs">
              <DsText as="span" variant="meta" data-testid="studio-card-no">{{ row.no }}</DsText>
              <DsBadge :label="row.statusText" :tone="statusTone(row.raw.status)" data-testid="studio-row-status" />
              <DsBadge v-if="row.raw.dskpComplete === false" tone="warning" size="sm" label="Belum ditanda DSKP" data-testid="studio-row-dskp" />
            </DsCluster>
            <DsText
              :ref="(el: unknown) => measureStem(row.id, el)"
              variant="body"
              wrap="anywhere"
              :clamp="expanded.has(row.id) ? undefined : 3"
              data-testid="studio-card-stem"
            >{{ row.raw.questionText }}</DsText>
            <UButton
              v-if="clamped[row.id] || expanded.has(row.id)"
              type="button"
              color="neutral"
              variant="link"
              :aria-expanded="expanded.has(row.id)"
              data-testid="studio-card-more"
              @click="toggleStem(row.id)"
            >{{ expanded.has(row.id) ? 'Tunjuk kurang' : 'Lihat penuh' }}</UButton>
            <DsText as="span" variant="caption" data-testid="studio-card-kertas">{{ row.kertas }}</DsText>
            <DsText as="span" variant="caption" data-testid="studio-card-sumber">Sumber: {{ row.sumber }}</DsText>
            <DsText v-if="reports[row.id]" as="span" variant="caption" data-testid="studio-row-served">{{ servedCaption(reports[row.id]!) }}</DsText>
          </DsStack>
        </template>
        <template #card-actions="{ row }">
          <DsRowActions :actions="rowActions((row as TableRow).raw)" :inline="3" testid="studio-row-more" />
        </template>
      </DsDataTable>
    </template>

    <StudioPreview v-model:open="previewOpen" :group="previewGroup" :draft="previewDraft" :question-id="previewId" :unsupported="previewUnsupported" />
    <DsDialog v-model:open="startOpen" title="Cipta baharu" data-testid="studio-start">
      <DsStack gap="md">
        <DsCluster v-if="!startGroup" gap="sm">
          <UButton :to="CREATE_PATH" color="primary" data-testid="studio-start-single">Soalan tunggal</UButton>
          <UButton type="button" color="neutral" variant="soft" data-testid="studio-start-group" @click="startGroup = true">Kumpulan rangsangan</UButton>
        </DsCluster>
        <DsStack v-else as="form" gap="md" data-testid="studio-start-form" @submit.prevent="createNewGroup">
          <DsFormField v-slot="{ id }" native label="Subjek" for="studio-start-subject" required :error="groupErrors.subjectId">
            <DsNativeSelect :id="id" v-model="groupForm.subjectId" placeholder="Pilih subjek" data-testid="studio-start-subject">
              <option v-for="o in subjectOptions" :key="o.id" :value="String(o.id)">{{ o.name }}</option>
            </DsNativeSelect>
          </DsFormField>
          <DsFormField v-slot="{ id }" native label="Tingkatan" for="studio-start-level" required :error="groupErrors.educationLevelId">
            <DsNativeSelect :id="id" v-model="groupForm.educationLevelId" placeholder="Pilih Tingkatan" data-testid="studio-start-level">
              <option v-for="o in levelOptions" :key="o.id" :value="String(o.id)">{{ o.name }}</option>
            </DsNativeSelect>
          </DsFormField>
          <DsFormField v-slot="{ id }" native label="Kertas (pilihan)" for="studio-start-kertas">
            <DsNativeSelect :id="id" v-model="groupForm.kertas" data-testid="studio-start-kertas">
              <option value="">—</option>
              <option value="1">Kertas 1</option>
              <option value="2">Kertas 2</option>
              <option value="3">Kertas 3</option>
            </DsNativeSelect>
          </DsFormField>
          <StudioStimulusEditor v-model="groupStimulus" testid="studio-start-stimulus" />
          <DsStack gap="xs" data-testid="studio-start-bank">
            <DsText variant="label">Bank pilihan (A-H)</DsText>
            <DsCluster v-for="(_b, i) in groupBank" :key="i" gap="xs" :wrap="false">
              <DsText variant="label" tabular>{{ BANK_LETTERS[i] }}</DsText>
              <UInput v-model="groupBank[i]" :aria-label="`Pilihan ${BANK_LETTERS[i]}`" :data-testid="`studio-start-bank-${i}`" />
              <UButton type="button" color="error" variant="soft" :data-testid="`studio-start-bank-${i}-remove`" @click="groupBank.splice(i, 1)">Buang</UButton>
            </DsCluster>
            <UButton v-if="groupBank.length < BANK_LETTERS.length" type="button" color="neutral" variant="soft" data-testid="studio-start-bank-add" @click="groupBank.push('')">+ Pilihan</UButton>
          </DsStack>
          <DsStack v-if="groupProblems.length > 0" gap="2xs" role="alert" data-testid="studio-start-problems">
            <DsText v-for="p in groupProblems" :key="p" variant="body" tone="error">{{ p }}</DsText>
          </DsStack>
          <DsCluster gap="sm">
            <UButton type="submit" color="primary" :loading="groupBusy" data-testid="studio-start-create">Cipta kumpulan</UButton>
            <UButton type="button" color="neutral" variant="soft" data-testid="studio-start-cancel" @click="startOpen = false">Batal</UButton>
          </DsCluster>
        </DsStack>
      </DsStack>
    </DsDialog>
  </DsPage>
</template>
