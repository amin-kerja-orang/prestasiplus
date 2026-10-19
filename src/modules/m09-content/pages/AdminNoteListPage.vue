<script setup lang="ts">
/**
 * S5 `/admin/notes` "Pengurusan Nota - Admin PRESTASIPLUS" (FR-M09-42..45; DV-M09-06), v2 staff theme.
 *
 * - Page header row, KPI strip, filter bar (`search`, `subject`, `note_type`) with active-filter chips; the
 *   "Jenis" options keep their live labels and the server matches them by meaning (DV-M09-06). The query
 *   string is the state.
 * - Table of 20 rows per page from `GET /api/admin/notes` (id ascending); the pager keeps the filters. Below
 *   `md` every row is a card. Row actions sit in one menu; delete asks `useConfirm`.
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
  DsStack,
  DsText,
} from '@/ds'
import type { CardField, RowAction, StatItem } from '@/ds'

import { deleteAdminNote, fetchAdminNotes, type AdminNoteItem } from '../api/admin-articles-notes'
import { cellClass } from '../lib/table-cols'
import {
  COPY,
  NOTES_LIST_PATH,
  NOTE_ROUTES,
  NOTE_SUBJECT_OPTIONS,
  NOTE_TYPE_FILTER_OPTIONS,
  errorLines,
  limitText,
  noteGradeText,
  noteSubjectText,
  queryPage,
  queryText,
} from '../lib/admin-articles-notes'

const route = useRoute()
const router = useRouter()
const flash = useFlash()
const confirm = useConfirm()

/** The applied filters, read from the URL (live names: `search`, `subject`, `note_type`). */
const applied = computed(() => ({
  search: queryText(route.query.search).trim(),
  subject: queryText(route.query.subject),
  noteType: queryText(route.query.note_type),
  page: queryPage(route.query.page),
}))

const search = ref(queryText(route.query.search))
const subject = ref(queryText(route.query.subject) || 'all')
const noteType = ref(queryText(route.query.note_type) || 'all')
watch(
  () => [route.query.search, route.query.subject, route.query.note_type] as const,
  ([s, sub, type]) => {
    search.value = queryText(s)
    subject.value = queryText(sub) || 'all'
    noteType.value = queryText(type) || 'all'
  },
)

const { data, error, reload } = useApi(
  (signal) =>
    fetchAdminNotes(
      {
        search: applied.value.search,
        subject: applied.value.subject,
        noteType: applied.value.noteType,
        page: applied.value.page,
      },
      { signal },
    ),
  [
    () => route.query.search,
    () => route.query.subject,
    () => route.query.note_type,
    () => route.query.page,
  ],
)

const rows = computed<AdminNoteItem[]>(() => data.value?.data ?? [])
const total = computed(() => data.value?.meta.totalItems ?? 0)
const firstLoad = computed(() => data.value === null && error.value === null)
const publishedOnPage = computed(() => rows.value.filter((r) => r.isPublished).length)
const downloadsOnPage = computed(() => rows.value.reduce((sum, r) => sum + r.downloads, 0))

const pagerQuery = computed(() => {
  const out: Record<string, string> = {}
  if (applied.value.search !== '') out.search = applied.value.search
  if (applied.value.subject !== '') out.subject = applied.value.subject
  if (applied.value.noteType !== '') out.note_type = applied.value.noteType
  return out
})

const chips = computed(() => {
  const out: { key: string; label: string }[] = []
  if (applied.value.search !== '') out.push({ key: 'search', label: `"${applied.value.search}"` })
  const sub = NOTE_SUBJECT_OPTIONS.find((o) => o.value === applied.value.subject)
  if (sub) out.push({ key: 'subject', label: sub.label })
  const type = NOTE_TYPE_FILTER_OPTIONS.find(
    (o) => o.value === applied.value.noteType && o.value !== 'all',
  )
  if (type) out.push({ key: 'note_type', label: type.label })
  return out
})

function formQuery(): Record<string, string> {
  const out: Record<string, string> = {}
  const s = search.value.trim()
  if (s !== '') out.search = s
  if (subject.value !== '' && subject.value !== 'all') out.subject = subject.value
  if (noteType.value !== '' && noteType.value !== 'all') out.note_type = noteType.value
  return out
}

async function submitFilter(): Promise<void> {
  const query = formQuery()
  if (JSON.stringify(query) === JSON.stringify(pagerQuery.value) && !route.query.page) {
    await reload()
  } else {
    await router.push({ path: NOTES_LIST_PATH, query })
  }
}

async function resetFilter(): Promise<void> {
  await router.push({ path: NOTES_LIST_PATH })
}

async function removeChip(key: string): Promise<void> {
  const query = { ...pagerQuery.value }
  delete query[key]
  await router.push({ path: NOTES_LIST_PATH, query })
}

function goToPage(page: number): void {
  void router.push({ path: NOTES_LIST_PATH, query: { ...pagerQuery.value, page: String(page) } })
}

const deleting = ref(false)

async function remove(row: AdminNoteItem): Promise<void> {
  if (deleting.value) return
  if (!(await confirm({ message: COPY.confirmDeleteNote, tone: 'error' }))) return
  deleting.value = true
  try {
    const result = await deleteAdminNote(row.id)
    await reload()
    if (rows.value.length === 0 && applied.value.page > 1) {
      await router.push({
        path: NOTES_LIST_PATH,
        query: { ...pagerQuery.value, page: String(applied.value.page - 1) },
      })
    }
    flash.show({ type: 'success', message: result.status })
  } catch (err) {
    flash.show({ type: 'error', message: errorLines(err) })
  } finally {
    deleting.value = false
  }
}

function actionsOf(row: AdminNoteItem): RowAction[] {
  return [
    {
      label: 'Edit',
      icon: 'i-ph-pencil-simple',
      to: `${NOTES_LIST_PATH}/${String(row.id)}/edit`,
    },
    { label: 'Lihat', icon: 'i-ph-eye', to: `${NOTES_LIST_PATH}/${String(row.id)}` },
    {
      label: 'Padam',
      icon: 'i-ph-trash',
      danger: true,
      disabled: deleting.value,
      onSelect: () => void remove(row),
    },
  ]
}

const statItems = computed<StatItem[]>(() => [
  { key: 'k1', label: 'Jumlah nota', value: total.value, icon: 'notebook', accent: 'action' },
  {
    key: 'k2',
    label: 'Diterbitkan (halaman ini)',
    value: publishedOnPage.value,
    icon: 'check-circle',
    accent: 'win',
  },
  {
    key: 'k3',
    label: 'Muat turun (halaman ini)',
    value: downloadsOnPage.value,
    icon: 'download-simple',
    accent: 'trial',
  },
])

interface TableRow extends Record<string, unknown> {
  id: number
  title: string
  subjectText: string
  noteType: string
  gradeText: string
  raw: AdminNoteItem
}

const tableRows = computed<TableRow[]>(() =>
  rows.value.map((r) => ({
    id: r.id,
    title: limitText(r.title, 40),
    subjectText: noteSubjectText(r.subject),
    noteType: r.noteType,
    gradeText: noteGradeText(r.grade),
    raw: r,
  })),
)

const columns: TableColumn<TableRow>[] = [
  { accessorKey: 'title', header: 'Tajuk', ...cellClass('') },
  { accessorKey: 'subjectText', header: 'Subjek', ...cellClass('w-40') },
  { accessorKey: 'noteType', header: 'Jenis', ...cellClass('w-28') },
  { accessorKey: 'gradeText', header: 'Tahap', ...cellClass('w-28') },
  { id: 'status', header: 'Status', ...cellClass('w-40') },
  { id: 'stats', header: 'Statistik', ...cellClass('w-36') },
  { id: 'actions', header: 'Tindakan', ...cellClass('w-36') },
]
const cardFields: CardField[] = [
  { key: 'subjectText', label: 'Subjek' },
  { key: 'noteType', label: 'Jenis' },
  { key: 'gradeText', label: 'Tahap' },
]
</script>

<template>
  <DsPage subtitle-testid="admin-notes-count" data-testid="admin-notes-page">
    <template #subtitle>Jumlah: {{ total }} nota</template>
    <template #actions>
      <UButton
        :to="{ name: NOTE_ROUTES.create }"
        icon="i-ph-plus"
        label="Tambah Nota"
        class="min-h-11"
        data-testid="admin-notes-add"
      />
    </template>

    <DsStatRow :items="statItems" prefix="stat" :cols="3" />

    <DsStack gap="sm">
      <DsFilterBar
        :chips="chips"
        data-testid="admin-notes-filter"
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
            placeholder="Cari nota..."
            icon="i-ph-magnifying-glass"
            size="md"
            class="w-full md:min-w-64 md:grow"
            data-testid="admin-notes-search"
          />
        </template>
        <DsNativeSelect
          v-model="subject"
          name="subject"
          aria-label="Subjek"
          class="md:w-48"
          data-testid="admin-notes-subject"
        >
          <option value="all">Semua Subjek</option>
          <option v-for="o in NOTE_SUBJECT_OPTIONS" :key="o.value" :value="o.value">
            {{ o.label }}
          </option>
        </DsNativeSelect>
        <DsNativeSelect
          v-model="noteType"
          name="note_type"
          aria-label="Jenis"
          class="md:w-44"
          data-testid="admin-notes-type"
        >
          <option v-for="o in NOTE_TYPE_FILTER_OPTIONS" :key="o.value" :value="o.value">
            {{ o.label }}
          </option>
        </DsNativeSelect>
      </DsFilterBar>
    </DsStack>

    <DsLoadError
      v-if="error"
      :message="errorLines(error).join(' ')"
      testid="admin-notes-error"
      @retry="reload()"
    />

    <DsPanel v-else-if="!firstLoad && rows.length === 0" data-testid="admin-notes-empty">
      <DsEmptyState :title="COPY.noteEmpty" icon="i-ph-notebook" />
    </DsPanel>

    <DsDataTable
      v-else
      variant="flush"
      layout="fixed"
      :data="tableRows"
      :columns="columns"
      caption="Senarai nota"
      :loading="firstLoad"
      :total="total"
      :page-size="data?.meta.pageSize ?? 20"
      :page="applied.page"
      card-title="title"
      :card-fields="cardFields"
      :empty-title="COPY.noteEmpty"
      data-testid="admin-notes-table"
      @update:page="goToPage"
    >
      <template #title-cell="{ row }">
        <DsStack
          gap="2xs"
          class="min-w-40"
          data-testid="admin-note-row"
          :data-note-id="row.original.id"
        >
          <DsText variant="label" as="p" tone="highlighted" :clamp="2" data-testid="note-title">
            {{ row.original.title }}
          </DsText>
          <DsText v-if="row.original.raw.author" variant="caption" data-testid="note-author">
            Oleh: {{ row.original.raw.author.name }}
          </DsText>
        </DsStack>
      </template>
      <template #subjectText-cell="{ row }">
        <UBadge
          color="primary"
          variant="subtle"
          :label="row.original.subjectText"
          data-testid="note-subject"
        />
      </template>
      <template #noteType-cell="{ row }">
        <span class="text-nowrap" data-testid="note-type">{{ row.original.noteType }}</span>
      </template>
      <template #gradeText-cell="{ row }">
        <span class="text-nowrap" data-testid="note-grade">{{ row.original.gradeText }}</span>
      </template>
      <template #status-cell="{ row }">
        <DsStatusBadge
          :status="row.original.raw.isPublished ? 'published' : 'draft'"
          data-testid="status-pill"
        />
      </template>
      <template #stats-cell="{ row }">
        <div class="flex flex-col gap-1 text-caption text-nowrap text-muted">
          <span class="inline-flex items-center gap-2" data-testid="note-views">
            <UIcon name="i-ph-eye" class="size-4" aria-hidden="true" />
            {{ row.original.raw.views }} tontonan
          </span>
          <span class="inline-flex items-center gap-2" data-testid="note-downloads">
            <UIcon name="i-ph-download-simple" class="size-4" aria-hidden="true" />
            {{ row.original.raw.downloads }} muat turun
          </span>
        </div>
      </template>
      <template #actions-cell="{ row }">
        <DsRowActions :actions="actionsOf(row.original.raw)" :inline="1" />
      </template>
      <template #card-actions="{ row }">
        <DsRowActions :actions="actionsOf((row as unknown as TableRow).raw)" :inline="1" />
      </template>
    </DsDataTable>
  </DsPage>
</template>
