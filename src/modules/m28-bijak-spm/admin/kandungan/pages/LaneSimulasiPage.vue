<script setup lang="ts">
/**
 * Lane "Bijak SPM" (`/admin/spm/simulasi`, V2 `lane=simulasi`, AC-R1-21.2): one paper per row. Columns Senarai, Tajuk,
 * Status, Perhatian, Tindakan; row meta "{subjek} · {n} soalan"; Perhatian text per V2 for a published paper with no question
 * ("Disajikan tetapi tiada soalan"), else the servability sentences with their question counts (D94 copy, H2/H4).
 * Row action: Sunting -> Semak Kertas (the Pembina Kertas editor). Pratonton and Salin need screens that are not in this
 * base (UX-23).
 */
import type { TableColumn } from '@nuxt/ui'
import { computed } from 'vue'

import { DsDataTable, DsLoadError, DsStatusBadge } from '@/ds'

import { ADMIN_ROUTES } from '../../papers/ui'
import { kandunganServer } from '../client'
import { laneCopy } from '../lanes'
import { PAGE_SIZE, useLane } from '../use-lane'
import LaneShell from './LaneShell.vue'

import type { ServabilityPaperRow } from '@pp/contract'

type Row = ServabilityPaperRow & { no: number } & Record<string, unknown>

/** V2 `paper_statuses.label`: "Terbit" / "Draf". */
const STATUSES = [
  { value: 'published', label: 'Terbit' },
  { value: 'draft', label: 'Draf' },
]
const statusText = (code: string): string => STATUSES.find((s) => s.value === code)?.label ?? code

const server = kandunganServer()
const { filters, page, subjects, list, chips, removeChip } = useLane(server, (q) => server.paperLane(q), statusText)

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
  <LaneShell
    v-model:filters="filters"
    heading="Bijak SPM"
    :subjects="subjects"
    :statuses="STATUSES"
    :chips="chips"
    testid="lane-simulasi"
    @remove-chip="removeChip"
  >
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
        <DsStatusBadge :status="row.original.status === 'published' ? 'published' : 'draft'" :label="statusText(row.original.status)" />
      </template>
      <template #attention-cell="{ row }">
        <ul v-if="lines(row.original).length" class="flex flex-col gap-1" :data-testid="`attention-${row.original.paperId}`">
          <li v-for="l in lines(row.original)" :key="l" class="text-caption text-error">{{ l }}</li>
        </ul>
      </template>
      <template #card="{ row }">
        <div class="flex min-w-0 flex-1 flex-col gap-1">
          <p class="break-words text-body">{{ row.title }}</p>
          <p class="text-caption text-muted">{{ meta(row as unknown as ServabilityPaperRow) }}</p>
          <DsStatusBadge :status="row.status === 'published' ? 'published' : 'draft'" :label="statusText(row.status as string)" />
          <ul v-if="lines(row as unknown as ServabilityPaperRow).length" class="flex flex-col gap-1">
            <li v-for="l in lines(row as unknown as ServabilityPaperRow)" :key="l" class="text-caption text-error">{{ l }}</li>
          </ul>
        </div>
      </template>
      <template #card-actions="{ row }">
        <UButton
          size="sm"
          icon="i-ph-pencil-simple"
          :label="laneCopy.edit"
          class="min-h-11"
          :to="{ name: ADMIN_ROUTES.paperEdit, params: { id: row.paperId } }"
          :data-testid="`lane-edit-${String(row.paperId)}`"
        />
      </template>
      <template #actions-cell="{ row }">
        <UButton
          size="sm"
          icon="i-ph-pencil-simple"
          :label="laneCopy.edit"
          class="min-h-11"
          :to="{ name: ADMIN_ROUTES.paperEdit, params: { id: row.original.paperId } }"
          :data-testid="`lane-edit-${row.original.paperId}`"
        />
      </template>
    </DsDataTable>
  </LaneShell>
</template>
