<script setup lang="ts">
/**
 * Lane "Bijak SPM" (`/admin/spm/simulasi`, V2 `lane=simulasi`, AC-R1-21.2): one paper per row. Columns Senarai, Tajuk,
 * Status, Perhatian, Tindakan; row meta "{subjek} · {n} soalan"; Perhatian text per V2 for a published paper with no question
 * ("Disajikan tetapi tiada soalan"), else the servability sentences with their question counts (D94 copy, H2/H4).
 * Row actions (AC-ADM-Q02.2): Pratonton (the student view, as Pembina Kertas), Salin (a draft copy, flash and on to its builder)
 * and Sunting -> Semak Kertas (the Pembina Kertas editor).
 */
import type { TableColumn } from '@nuxt/ui'
import { computed, ref } from 'vue'

import { DsDataTable, DsLoadError, DsPage, DsRowActions, DsStatusBadge, DsText, type RowAction } from '@/ds'

import StudentViewDrawer from '../../builder/components/StudentViewDrawer.vue'
import { usePaperActions } from '../../builder/lib/use-paper-actions'
import { builderServer } from '../../builder/server/client'
import { ADMIN_ROUTES } from '../../papers/ui'
import { kandunganServer } from '../client'
import { laneCopy, PAPER_STATUS_OPTIONS, paperStatusBadge, paperStatusLabel } from '../lanes'
import { PAGE_SIZE, useLane } from '../use-lane'
import LaneShell from './LaneShell.vue'

import type { ServabilityPaperRow } from '@pp/contract'

type Row = ServabilityPaperRow & { no: number } & Record<string, unknown>

const statusText = paperStatusLabel
const STATUSES = PAPER_STATUS_OPTIONS

const server = kandunganServer()
const { filters, page, subjects, count, list, chips, removeChip } = useLane((q) => server.paperLane(q), statusText)

const actionId = ref('')
const paper = usePaperActions({ api: builderServer(), id: actionId, title: () => '', onChanged: () => {} })
async function openPreview(id: string): Promise<void> {
  actionId.value = id
  await paper.openStudentView()
}
async function copyRow(id: string): Promise<void> {
  actionId.value = id
  await paper.copy()
}
const actionsOf = (id: string): RowAction[] => [
  { label: laneCopy.preview, testid: `lane-preview-${id}`, onSelect: () => void openPreview(id) },
  { label: laneCopy.copy, testid: `lane-copy-${id}`, onSelect: () => void copyRow(id) },
  { label: laneCopy.edit, testid: `lane-edit-${id}`, to: { name: ADMIN_ROUTES.paperEdit, params: { id } } },
]

const rows = computed<Row[]>(() =>
  (list.data.value?.rows ?? []).map((r, i) => ({ ...r, no: (page.value - 1) * PAGE_SIZE + i + 1 })),
)
const columns: TableColumn<Row>[] = [
  { accessorKey: 'no', header: laneCopy.colList },
  { accessorKey: 'title', header: laneCopy.colTitle },
  { accessorKey: 'status', header: laneCopy.colStatus },
  { accessorKey: 'attention', header: laneCopy.colAttention },
  { id: 'actions', header: laneCopy.colActions },
]

/** The Perhatian lines of a paper (V2: only a published paper has any). */
function lines(r: ServabilityPaperRow): string[] {
  if (r.status !== 'published') return []
  if (r.questionCount === 0) return [laneCopy.noQuestions]
  return r.attention.map((a) => `${a.count} soalan: ${a.message}`)
}
const meta = (r: ServabilityPaperRow): string => `${r.subject?.name ?? ''} · ${r.questionCount} soalan`
</script>

<template>
  <DsPage layout="list" data-testid="lane-simulasi">
    <LaneShell
      v-model:filters="filters"
      lane="bijak-spm"
      :count="count"
      :subjects="subjects"
      :statuses="STATUSES"
      :chips="chips"
      @remove-chip="removeChip"
    />
    <DsLoadError v-if="list.error.value" message="Tidak dapat memuatkan senarai." @retry="list.reload()" />
    <DsDataTable
      v-else
      v-model:page="page"
      :data="rows"
      :columns="columns"
      :total="list.data.value?.total ?? 0"
      :page-size="PAGE_SIZE"
      caption="Bijak SPM"
      variant="flush"
      density="compact"
      :loading="list.loading.value && !list.data.value"
      :filtered="chips.length > 0"
      :empty-title="laneCopy.empty"
      card-title="title"
      :card-fields="[{ key: 'no', label: laneCopy.colList }]"
    >
      <template #title-cell="{ row }">
        <div class="min-w-0">
          <p class="break-words text-body">{{ row.original.title }}</p>
          <p class="text-caption text-muted">{{ meta(row.original) }}</p>
        </div>
      </template>
      <template #status-cell="{ row }">
        <DsStatusBadge :status="paperStatusBadge(row.original.status)" :label="statusText(row.original.status)" />
      </template>
      <template #attention-cell="{ row }">
        <ul v-if="lines(row.original).length" class="flex flex-col gap-1" :data-testid="`attention-${row.original.paperId}`">
          <li v-for="l in lines(row.original)" :key="l" class="text-caption text-error">{{ l }}</li>
        </ul>
        <DsText v-else variant="caption" tone="muted">{{ laneCopy.noAttention }}</DsText>
      </template>
      <template #card="{ row }">
        <div class="flex min-w-0 flex-1 flex-col gap-1">
          <p class="break-words text-body">{{ row.title }}</p>
          <p class="text-caption text-muted">{{ meta(row as unknown as ServabilityPaperRow) }}</p>
          <DsStatusBadge :status="paperStatusBadge(row.status as string)" :label="statusText(row.status as string)" />
          <ul v-if="lines(row as unknown as ServabilityPaperRow).length" class="flex flex-col gap-1">
            <li v-for="l in lines(row as unknown as ServabilityPaperRow)" :key="l" class="text-caption text-error">{{ l }}</li>
          </ul>
          <DsText v-else variant="caption" tone="muted">{{ laneCopy.noAttention }}</DsText>
          <DsRowActions :actions="actionsOf(String(row.paperId))" :inline="3" />
        </div>
      </template>
      <template #actions-cell="{ row }">
        <DsRowActions :actions="actionsOf(row.original.paperId)" :inline="3" />
      </template>
    </DsDataTable>
    <StudentViewDrawer v-model:open="paper.viewOpen.value" :view="paper.view.value" :error="paper.viewError.value" />
  </DsPage>
</template>
