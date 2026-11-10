<script setup lang="ts">
/**
 * The V2 page-image documents of the Kertas Subjektif list (`/admin/kertas-subjektif`, V2 `admin.kertas.index`): the tiles `Jumlah Kertas`,
 * `Diterbitkan`, `Ada Skema`, the table (Subjek, Kertas, Negeri, Tahun, Halaman, Status, Tindakan) with `Pratonton` and `Terbit` / `Sembunyikan`.
 * It sits beside the question-based papers on the same page and shares the filter bar (subject, kertas, status). Read and toggle only: the
 * documents are page images from the V2 import, not edited here.
 */
import type { TableColumn } from '@nuxt/ui'
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { useApi } from '@/composables/useApi'
import { useFlash } from '@/composables/useFlash'
import { DsBadge, DsCluster, DsDataTable, DsDefinitionList, DsLoadError, DsRowActions, DsStack, DsStatRow, DsStatusBadge, DsText, type DefinitionItem, type RowAction, type StatItem } from '@/ds'

import { kertasDokumenServer } from '../../server/documents-client'
import type { KertasDokumenAdminRow } from '../../server/documents-types'
import { SUBJEKTIF_ROUTES } from './ui'

type Row = KertasDokumenAdminRow & Record<string, unknown>

const props = defineProps<{ subject: string; kertas: string; status: string }>()

const PAGE_SIZE = 30
const server = kertasDokumenServer()
const router = useRouter()
const flash = useFlash()
const page = ref(1)

const query = computed(() => ({
  ...(props.subject ? { subject: props.subject } : {}),
  ...(props.kertas ? { kertas: Number(props.kertas) } : {}),
  ...(props.status ? { status: props.status as 'draf' | 'terbit' } : {}),
  page: page.value,
  pageSize: PAGE_SIZE,
}))
const list = useApi(() => server.adminList(query.value), query)
watch(
  () => [props.subject, props.kertas, props.status],
  () => {
    page.value = 1
  },
)

const rows = computed(() => (list.data.value?.rows ?? []) as Row[])
const total = computed(() => list.data.value?.total ?? 0)

const stats = computed<StatItem[]>(() => {
  const c = list.data.value?.counts
  return [
    { key: 'total', label: 'Jumlah Kertas', value: c ? c.total : '—', icon: 'scroll' },
    { key: 'published', label: 'Diterbitkan', value: c ? c.published : '—', icon: 'upload-simple', accent: 'win' },
    { key: 'scheme', label: 'Ada Skema', value: c ? c.withScheme : '—', icon: 'seal-check' },
  ]
})

const columns: TableColumn<Row>[] = [
  { accessorKey: 'subjectName', header: 'Subjek' },
  { accessorKey: 'kertas', header: 'Kertas' },
  { accessorKey: 'negeri', header: 'Negeri' },
  { accessorKey: 'year', header: 'Tahun' },
  { id: 'pages', header: 'Halaman' },
  { accessorKey: 'status', header: 'Status' },
  { id: 'actions', header: 'Tindakan' },
]

const dash = (v: string | number | null | undefined): string => (v === null || v === undefined || v === '' ? '—' : String(v))
const noScheme = (row: KertasDokumenAdminRow): boolean => row.schemePageCount === 0
const pagesText = (row: KertasDokumenAdminRow): string => (row.schemePageCount > 0 ? `${row.pageCount} + ${row.schemePageCount} skema` : String(row.pageCount))
const cardItems = (row: KertasDokumenAdminRow): DefinitionItem[] => [
  { key: 'subject', label: 'Subjek', value: dash(row.subjectName) },
  { key: 'kertas', label: 'Kertas', value: `K${row.kertas}` },
  { key: 'negeri', label: 'Negeri', value: dash(row.negeri) },
  { key: 'year', label: 'Tahun', value: dash(row.year) },
  { key: 'pages', label: 'Halaman', value: pagesText(row) },
]

const busyId = ref('')
async function toggle(row: Row): Promise<void> {
  busyId.value = row.id
  try {
    const r = await server.toggle(row.id)
    flash.show({ type: 'success', message: r.status === 'terbit' ? `“${r.title}” kini diterbitkan.` : `“${r.title}” disembunyikan daripada pelajar.` })
    await list.reload()
  } catch (e) {
    flash.show({ type: 'error', message: e instanceof Error && e.message ? e.message : 'Sesuatu tidak kena. Sila cuba lagi.' })
  } finally {
    busyId.value = ''
  }
}

function preview(row: Row): void {
  void router.push({ name: SUBJEKTIF_ROUTES.dokumen, params: { id: row.id } })
}

function actionsOf(row: Row): RowAction[] {
  const terbit = row.status === 'terbit'
  return [
    { label: 'Pratonton', testid: `sjd-preview-${row.id}`, onSelect: () => preview(row) },
    {
      label: terbit ? 'Sembunyikan' : 'Terbit',
      testid: `sjd-toggle-${row.id}`,
      loading: busyId.value === row.id,
      // V2: Terbit is disabled while the document has no page.
      disabled: !terbit && row.pageCount === 0,
      onSelect: () => void toggle(row),
    },
  ]
}
</script>

<template>
  <DsStack gap="md" data-testid="sjd-list">
    <DsStatRow :items="stats" density="compact" :cols="3" aria-label="Ringkasan kertas imbasan" />
    <slot name="filters" />
    <DsLoadError v-if="list.error.value" message="Tidak dapat memuatkan senarai kertas." @retry="list.reload()" />
    <DsDataTable
      v-else
      v-model:page="page"
      :data="rows"
      :columns="columns"
      :total="total"
      :page-size="PAGE_SIZE"
      caption="Senarai kertas imbasan"
      variant="flush"
      density="compact"
      :loading="list.loading.value && !list.data.value"
      empty-title="Tiada kertas sepadan penapis."
      empty-description=""
      card-title="subjectName"
      :card-fields="[
        { key: 'negeri', label: 'Negeri' },
        { key: 'year', label: 'Tahun' },
      ]"
      row-key="id"
      data-testid="sjd-table"
      @row-click="preview"
    >
      <template #subjectName-cell="{ row }">
        <DsStack gap="2xs">
          <DsText as="span" variant="body" wrap="anywhere">{{ dash(row.original.subjectName) }}</DsText>
          <DsText as="span" variant="caption" tone="muted" wrap="anywhere">{{ row.original.title }}</DsText>
        </DsStack>
      </template>
      <template #kertas-cell="{ row }">K{{ row.original.kertas }}</template>
      <template #negeri-cell="{ row }">{{ dash(row.original.negeri) }}</template>
      <template #year-cell="{ row }">{{ dash(row.original.year) }}</template>
      <template #pages-cell="{ row }">
        <DsCluster gap="xs">
          <DsText as="span" variant="body" tabular>{{ pagesText(row.original) }}</DsText>
          <DsBadge v-if="noScheme(row.original)" tone="warning" label="tiada skema" />
        </DsCluster>
      </template>
      <template #status-cell="{ row }">
        <DsStatusBadge :status="row.original.status === 'terbit' ? 'published' : 'draft'" />
      </template>
      <template #actions-cell="{ row }">
        <DsRowActions :actions="actionsOf(row.original)" :testid="`sjd-menu-${row.original.id}`" />
      </template>
      <template #card="{ row }">
        <DsStack gap="xs" align="start" :data-testid="`sjd-card-${String(row.id)}`">
          <UButton type="button" color="neutral" variant="link" :label="String(row.title)" @click="preview(row as Row)" />
          <DsDefinitionList :items="cardItems(row as Row)" :columns="2" />
          <DsCluster gap="xs">
            <DsStatusBadge :status="row.status === 'terbit' ? 'published' : 'draft'" />
            <DsBadge v-if="noScheme(row as Row)" tone="warning" label="tiada skema" />
          </DsCluster>
        </DsStack>
      </template>
      <template #card-actions="{ row }">
        <DsRowActions :actions="actionsOf(row as Row)" :testid="`sjd-menu-${String(row.id)}`" />
      </template>
    </DsDataTable>
  </DsStack>
</template>
