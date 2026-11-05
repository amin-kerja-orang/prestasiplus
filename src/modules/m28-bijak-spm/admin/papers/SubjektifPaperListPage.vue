<script setup lang="ts">
/**
 * Kertas Subjektif (`/admin/kertas-subjektif`, S3-T06, PRD30 Q-18): the Kertas 2/3/4 percubaan negeri papers, their
 * Terbit / Sembunyikan, Baharu and Sunting form (fields 18-02..18-08) and the row menu of 18-11. The content of a paper is
 * placed from its detail page; this list only shows the counts.
 */
import type { TableColumn } from '@nuxt/ui'
import { BIJAK_BUILDER_MESSAGES, BIJAK_NEGERI_ORDER, bijakNegeriSlug, type BijakBuilderStudentView } from '@pp/contract'
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

import { useApi } from '@/composables/useApi'
import { useFlash } from '@/composables/useFlash'
import {
  DsDataTable,
  DsBadge,
  DsCluster,
  DsDefinitionList,
  DsDialog,
  DsFilterBar,
  DsFormField,
  DsGrid,
  DsLoadError,
  DsNativeSelect,
  DsPage,
  DsRowActions,
  DsStack,
  DsStatRow,
  DsStatusBadge,
  DsText,
  type DefinitionItem,
  type RowAction,
  type StatItem,
} from '@/ds'

import type { AdminPaperSummary } from '../../domain/admin-types'
import StudentViewDrawer from '../builder/components/StudentViewDrawer.vue'
import { builderMessage, BuilderError, type SubjektifQuery } from '../builder/server/api'
import { builderServer } from '../builder/server/client'
import { SUBJEKTIF_ROUTES } from './ui'

type Row = AdminPaperSummary & Record<string, unknown>

const M = BIJAK_BUILDER_MESSAGES
const PAGE_SIZE = 25
const api = builderServer()
const router = useRouter()
const flash = useFlash()
const fill = (text: string, title: string): string => text.replace('{title}', title)

/* --------------------------------------------------------------------------------- list */
const filters = reactive({ subject: '', kertas: '', status: '' })
const applied = reactive({ subject: '', kertas: '', status: '' })
const page = ref(1)

const query = computed<SubjektifQuery>(() => ({
  ...(applied.subject ? { subject: applied.subject } : {}),
  ...(applied.kertas ? { kertas: Number(applied.kertas) } : {}),
  ...(applied.status ? { status: applied.status as 'draf' | 'terbit' } : {}),
  page: page.value,
  pageSize: PAGE_SIZE,
}))
const list = useApi(() => api.listSubjektif(query.value), query)
const subjects = useApi(() => api.builderSubjects())

const rows = computed(() => (list.data.value?.rows ?? []) as Row[])
const total = computed(() => list.data.value?.total ?? 0)

/** The subject filter: the subjects with a blueprint plus any subject already on a row. */
const subjectItems = computed(() => {
  const map = new Map<string, string>()
  for (const s of subjects.data.value ?? []) map.set(s.code, s.name)
  for (const r of rows.value) if (!map.has(r.subject)) map.set(r.subject, r.subjectName)
  return [...map].map(([code, name]) => ({ code, name }))
})

const stats = computed<StatItem[]>(() => {
  const c = list.data.value?.counts
  return [
    { key: 'total', label: 'Jumlah Kertas', value: c?.total ?? null, icon: 'scroll' },
    { key: 'published', label: 'Diterbitkan', value: c?.published ?? null, icon: 'upload-simple', accent: 'win' },
    { key: 'scheme', label: 'Ada Skema', value: c?.withScheme ?? null, icon: 'seal-check' },
  ]
})

function applyFilters(): void {
  Object.assign(applied, filters)
  page.value = 1
}
function resetFilters(): void {
  Object.assign(filters, { subject: '', kertas: '', status: '' })
  applyFilters()
}

const columns: TableColumn<Row>[] = [
  { accessorKey: 'title', header: 'Tajuk' },
  { accessorKey: 'subjectName', header: 'Subjek' },
  { accessorKey: 'kertas', header: 'Kertas' },
  { accessorKey: 'examBoard', header: 'Negeri' },
  { accessorKey: 'year', header: 'Tahun' },
  { id: 'content', header: 'Kandungan' },
  { accessorKey: 'status', header: 'Status' },
  { id: 'actions', header: 'Tindakan' },
]

/** "{q} soalan" or "{q} soalan, {s} bersekema". */
function contentText(row: AdminPaperSummary): string {
  const s = row.schemeCount ?? 0
  return s > 0 ? `${row.questionCount} soalan, ${s} bersekema` : `${row.questionCount} soalan`
}
const noScheme = (row: AdminPaperSummary): boolean => (row.schemeCount ?? 0) < row.questionCount
const negeriLabel = (v: string | null | undefined): string => {
  if (!v) return '—'
  return BIJAK_NEGERI_ORDER.find((n) => bijakNegeriSlug(n) === bijakNegeriSlug(v)) ?? v
}
/** Label/value pairs of the mobile card. */
const cardItems = (row: AdminPaperSummary): DefinitionItem[] => [
  { key: 'subject', label: 'Subjek', value: row.subjectName },
  { key: 'kertas', label: 'Kertas', value: `K${row.kertas}` },
  { key: 'negeri', label: 'Negeri', value: negeriLabel(row.examBoard) },
  { key: 'year', label: 'Tahun', value: row.year ?? null },
  { key: 'tempoh', label: 'Tempoh (minit)', value: tempoh(row) },
  { key: 'content', label: 'Kandungan', value: contentText(row) },
]
const tempoh = (row: AdminPaperSummary): string => (row.durationMinutes ? String(row.durationMinutes) : '—')

/* ------------------------------------------------------------------------- row actions */
const busyId = ref('')

async function toggleStatus(row: Row): Promise<void> {
  busyId.value = row.id
  try {
    if (row.status === 'terbit') {
      await api.withdraw(row.id)
      flash.show({ type: 'success', message: fill(M.subjektifHidden, row.title) })
    } else {
      const r = await api.publish(row.id)
      if (!r.ok) {
        flash.show({ type: 'error', message: r.errors.join(' ') || fill(M.subjektifNoContent, row.title) })
        return
      }
      flash.show({ type: 'success', message: fill(M.subjektifPublished, row.title) })
    }
    await list.reload()
  } catch (e) {
    flash.show({ type: 'error', message: builderMessage(e, 'Sesuatu tidak kena. Sila cuba lagi.') })
  } finally {
    busyId.value = ''
  }
}

async function remove(row: Row): Promise<void> {
  try {
    await api.deletePaper(row.id)
    flash.show({ type: 'success', message: fill(M.subjektifDeleted, row.title) })
    await list.reload()
  } catch (e) {
    flash.show({ type: 'error', message: builderMessage(e, 'Sesuatu tidak kena. Sila cuba lagi.') })
  }
}

const preview = ref<BijakBuilderStudentView | null>(null)
const previewOpen = ref(false)
const previewError = ref(false)
async function openPreview(row: Row): Promise<void> {
  preview.value = null
  previewError.value = false
  previewOpen.value = true
  try {
    preview.value = await api.studentView(row.id)
  } catch {
    previewError.value = true
  }
}

function openDetail(row: Row): void {
  void router.push({ name: SUBJEKTIF_ROUTES.detail, params: { id: row.id } })
}

function actionsOf(row: Row): RowAction[] {
  const terbit = row.status === 'terbit'
  return [
    { label: 'Pratonton', testid: `sj-preview-${row.id}`, onSelect: () => void openPreview(row) },
    { label: 'Sunting', testid: `sj-edit-${row.id}`, onSelect: () => openEdit(row) },
    { label: 'Kandungan', testid: `sj-content-${row.id}`, onSelect: () => openDetail(row) },
    {
      label: terbit ? 'Sembunyikan' : 'Terbit',
      testid: `sj-toggle-${row.id}`,
      loading: busyId.value === row.id,
      onSelect: () => void toggleStatus(row),
    },
    {
      label: 'Padam',
     
      danger: true,
      testid: `sj-delete-${row.id}`,
      confirm: { title: 'Padam kertas ini?', confirmLabel: 'Ya, Padam' },
      onSelect: () => void remove(row),
    },
  ]
}

/* ------------------------------------------------------------------ Baharu / Sunting form */
const KERTAS = [2, 3, 4]
const thisYear = new Date().getFullYear()
const YEARS = Array.from({ length: thisYear - 2015 + 1 }, (_, i) => thisYear - i)

const formOpen = ref(false)
const editing = ref<Row | null>(null)
const saving = ref(false)
const form = reactive({ title: '', subject: '', kertas: '', examBoard: '', year: '', durationMinutes: '', totalMarks: '' })
const errors = reactive<Record<string, string>>({})

function clearErrors(): void {
  for (const k of Object.keys(errors)) delete errors[k]
}

function openCreate(): void {
  editing.value = null
  Object.assign(form, { title: '', subject: '', kertas: '', examBoard: '', year: '', durationMinutes: '', totalMarks: '' })
  clearErrors()
  formOpen.value = true
}

function openEdit(row: Row): void {
  editing.value = row
  Object.assign(form, {
    title: row.title,
    subject: row.subject,
    kertas: String(row.kertas),
    examBoard: row.examBoard ? bijakNegeriSlug(row.examBoard) : '',
    year: row.year ? String(row.year) : '',
    durationMinutes: row.durationMinutes ? String(row.durationMinutes) : '',
    totalMarks: row.totalMarks ? String(row.totalMarks) : '',
  })
  clearErrors()
  formOpen.value = true
}

const numberOf = (v: string | number | null | undefined): number | null => (String(v ?? '').trim() === '' ? null : Number(v))

/** The checks of 18-02..18-08; the server repeats them and its 422 `fields` win. */
function validate(): void {
  clearErrors()
  const title = form.title.trim()
  if (!title) errors.title = M.subjektifTitleRequired
  else if (title.length > 150) errors.title = M.subjektifTitleTooLong
  if (!editing.value && !form.subject) errors.subject = M.subjectRequired
  if (!editing.value && !KERTAS.includes(Number(form.kertas))) errors.kertas = M.kertasInvalid
  if (!form.examBoard) errors.examBoard = M.examBoardRequired
  if (!form.year) errors.year = M.yearRequired
  const d = numberOf(form.durationMinutes)
  if (d !== null && (!Number.isInteger(d) || d < 0 || d > 300)) errors.durationMinutes = M.durationRange
  const m = numberOf(form.totalMarks)
  if (m === null || !Number.isInteger(m) || m < 1 || m > 200) errors.totalMarks = M.totalMarksRange
}

async function save(): Promise<void> {
  validate()
  if (Object.keys(errors).length || saving.value) return
  saving.value = true
  const duration = numberOf(form.durationMinutes)
  try {
    if (editing.value) {
      await api.updateHeader(editing.value.id, {
        title: form.title.trim(),
        examBoard: form.examBoard,
        year: Number(form.year),
        durationMinutes: duration,
        totalMarks: Number(form.totalMarks),
      })
      flash.show({ type: 'success', message: fill(M.subjektifUpdated, form.title.trim()) })
    } else {
      await api.createSubjektif({
        title: form.title.trim(),
        subject: form.subject,
        kertas: Number(form.kertas),
        examBoard: form.examBoard,
        year: Number(form.year),
        ...(duration !== null ? { durationMinutes: duration } : {}),
        totalMarks: Number(form.totalMarks),
      })
      flash.show({ type: 'success', message: fill(M.subjektifCreated, form.title.trim()) })
    }
    formOpen.value = false
    await list.reload()
  } catch (e) {
    if (e instanceof BuilderError && e.kind === 'invalid' && Object.keys(e.fields).length) Object.assign(errors, e.fields)
    else flash.show({ type: 'error', message: builderMessage(e, 'Sesuatu tidak kena. Sila cuba lagi.') })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <DsPage layout="list" data-testid="sj-list-page">
    <template #actions>
      <UButton icon="file-plus" label="Baharu" data-testid="sj-new" @click="openCreate" />
    </template>

    <DsStatRow :items="stats" density="compact" :cols="3" aria-label="Ringkasan kertas subjektif" />

    <DsFilterBar :show-reset="false" apply-label="Tapis" data-testid="sj-filters" @apply="applyFilters" @reset="resetFilters">
      <DsNativeSelect v-model="filters.subject" aria-label="Subjek" data-testid="sj-filter-subject">
        <option value="">Semua Subjek</option>
        <option v-for="s in subjectItems" :key="s.code" :value="s.code">{{ s.name }}</option>
      </DsNativeSelect>
      <DsNativeSelect v-model="filters.kertas" aria-label="Kertas" data-testid="sj-filter-kertas">
        <option value="">Semua Kertas</option>
        <option v-for="k in KERTAS" :key="k" :value="String(k)">Kertas {{ k }}</option>
      </DsNativeSelect>
      <DsNativeSelect v-model="filters.status" aria-label="Status" data-testid="sj-filter-status">
        <option value="">Semua Status</option>
        <option value="terbit">Terbit</option>
        <option value="draf">Draf</option>
      </DsNativeSelect>
    </DsFilterBar>

    <DsLoadError v-if="list.error.value" message="Tidak dapat memuatkan senarai kertas." @retry="list.reload()" />
    <DsDataTable
      v-else
      v-model:page="page"
      :data="rows"
      :columns="columns"
      :total="total"
      :page-size="PAGE_SIZE"
      caption="Senarai kertas subjektif"
      variant="flush"
      density="compact"
      :loading="list.loading.value && !list.data.value"
      empty-title="Tiada kertas sepadan penapis."
      empty-description=""
      card-title="title"
      :card-fields="[
        { key: 'subjectName', label: 'Subjek' },
        { key: 'year', label: 'Tahun' },
      ]"
      row-key="id"
      data-testid="sj-table"
      @row-click="openDetail"
    >
      <template #title-cell="{ row }">
        <DsStack gap="2xs">
          <DsText as="span" variant="body" wrap="anywhere">{{ row.original.title }}</DsText>
          <DsText as="span" variant="caption" tone="muted">Tempoh (minit): {{ tempoh(row.original) }}</DsText>
        </DsStack>
      </template>
      <template #kertas-cell="{ row }">K{{ row.original.kertas }}</template>
      <template #examBoard-cell="{ row }">{{ negeriLabel(row.original.examBoard) }}</template>
      <template #content-cell="{ row }">{{ contentText(row.original) }}</template>
      <template #status-cell="{ row }">
        <DsCluster gap="xs">
          <DsStatusBadge :status="row.original.status === 'terbit' ? 'published' : 'draft'" />
          <DsBadge v-if="noScheme(row.original)" tone="warning" label="tiada skema" />
        </DsCluster>
      </template>
      <template #actions-cell="{ row }">
        <DsRowActions :actions="actionsOf(row.original)" :testid="`sj-menu-${row.original.id}`" />
      </template>
      <template #card="{ row }">
        <DsStack gap="xs" align="start" :data-testid="`sj-card-${String(row.id)}`">
          <UButton
            type="button"
            color="neutral"
            variant="link"
            :label="String(row.title)"
            @click="openDetail(row as Row)"
          />
          <DsDefinitionList :items="cardItems(row as Row)" :columns="2" />
          <DsCluster gap="xs">
            <DsStatusBadge :status="row.status === 'terbit' ? 'published' : 'draft'" />
            <DsBadge v-if="noScheme(row as Row)" tone="warning" label="tiada skema" />
          </DsCluster>
        </DsStack>
      </template>
      <template #card-actions="{ row }">
        <DsRowActions :actions="actionsOf(row as Row)" :testid="`sj-menu-${String(row.id)}`" />
      </template>
    </DsDataTable>

    <DsDialog v-model:open="formOpen" :title="editing ? 'Sunting' : 'Baharu'" :loading="saving" data-testid="sj-form-dialog">
      <DsStack as="form" gap="md" data-testid="sj-form" @submit.prevent="save">
        <DsFormField label="Tajuk" required :error="errors.title">
          <UInput v-model="form.title" placeholder="Contoh: Bahasa Melayu Kertas 2" data-testid="sj-f-title" />
        </DsFormField>
        <DsGrid :cols="{ base: 1, sm: 2 }" gap="md">
          <DsFormField label="Subjek" required :error="errors.subject">
            <DsNativeSelect v-model="form.subject" aria-label="Subjek" :disabled="!!editing" data-testid="sj-f-subject">
              <option value="">Tiada subjek</option>
              <option v-for="s in subjectItems" :key="s.code" :value="s.code">{{ s.name }}</option>
            </DsNativeSelect>
          </DsFormField>
          <DsFormField label="Kertas" required :error="errors.kertas">
            <DsNativeSelect v-model="form.kertas" aria-label="Kertas" :disabled="!!editing" data-testid="sj-f-kertas">
              <option value="">Pilih kertas</option>
              <option v-for="k in KERTAS" :key="k" :value="String(k)">Kertas {{ k }}</option>
            </DsNativeSelect>
          </DsFormField>
          <DsFormField label="Negeri" required :error="errors.examBoard">
            <DsNativeSelect v-model="form.examBoard" aria-label="Negeri" data-testid="sj-f-negeri">
              <option value="">Pilih negeri</option>
              <option v-for="n in BIJAK_NEGERI_ORDER" :key="n" :value="bijakNegeriSlug(n)">{{ n }}</option>
            </DsNativeSelect>
          </DsFormField>
          <DsFormField label="Tahun" required :error="errors.year">
            <DsNativeSelect v-model="form.year" aria-label="Tahun" data-testid="sj-f-year">
              <option value="">Pilih tahun</option>
              <option v-for="y in YEARS" :key="y" :value="String(y)">{{ y }}</option>
            </DsNativeSelect>
          </DsFormField>
          <DsFormField label="Tempoh (minit)" :error="errors.durationMinutes">
            <UInput v-model="form.durationMinutes" type="number" inputmode="numeric" data-testid="sj-f-duration" />
          </DsFormField>
          <DsFormField label="Jumlah Markah" required :error="errors.totalMarks">
            <UInput v-model="form.totalMarks" type="number" inputmode="numeric" data-testid="sj-f-marks" />
          </DsFormField>
        </DsGrid>
      </DsStack>
      <template #footer>
        <UButton color="neutral" variant="soft" label="Batal" data-testid="sj-f-cancel" @click="formOpen = false" />
        <UButton :label="editing ? 'Simpan' : 'Cipta'" :loading="saving" data-testid="sj-f-submit" @click="save" />
      </template>
    </DsDialog>

    <StudentViewDrawer v-model:open="previewOpen" :view="preview" :error="previewError" />
  </DsPage>
</template>
