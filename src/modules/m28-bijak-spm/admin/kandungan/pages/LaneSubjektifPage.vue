<script setup lang="ts">
/**
 * Lane "Subjektif" (`/admin/spm/subjektif`, FR-ADM-Q23.3, frame R1-ADM-Q-02): structured and essay questions, one per row. `Perhatian`
 * shows the sentences from the API ("Tiada skema ...", "Tiada kunci jawapan ..."), "—" when nothing is wrong. These questions are edited
 * in the Studio wizard, so `Sunting` and `Pratonton` open it, unlike the MCQ form of the Databank lane.
 */
import type { TableColumn } from '@nuxt/ui'
import type { ServabilityLaneRow } from '@pp/contract'
import { computed } from 'vue'

import { DsDataTable, DsLoadError, DsPage, DsRowActions, DsStack, DsText, type RowAction } from '@/ds'

import { kandunganServer } from '../client'
import { laneCopy, QUESTION_STATUS_OPTIONS, questionStatusLabel } from '../lanes'
import { PAGE_SIZE, useLane } from '../use-lane'
import LaneShell from './LaneShell.vue'

type Row = ServabilityLaneRow & { no: number } & Record<string, unknown>

const statusText = questionStatusLabel
const editPath = (id: string): string => `/admin/studio/questions/${id}/sunting`
const actionsOf = (id: string): RowAction[] => [
  { label: laneCopy.preview, testid: `lane-preview-${id}`, to: `${editPath(id)}?pratonton=1` },
  { label: laneCopy.edit, testid: `lane-edit-${id}`, to: editPath(id) },
]

const server = kandunganServer()
const { filters, page, subjects, count, list, chips, removeChip } = useLane((q) => server.subjektifLane(q), statusText)

const rows = computed<Row[]>(() =>
  (list.data.value?.rows ?? []).map((r, i) => ({ ...r, no: (page.value - 1) * PAGE_SIZE + i + 1 })),
)
const columns: TableColumn<Row>[] = [
  { accessorKey: 'no', header: laneCopy.colList },
  { accessorKey: 'title', header: laneCopy.colTitle },
  { accessorKey: 'attention', header: laneCopy.colAttention },
  { id: 'actions', header: laneCopy.colActions },
]
</script>

<template>
  <DsPage layout="list" data-testid="lane-subjektif">
    <LaneShell
      v-model:filters="filters"
      lane="subjektif"
      :count="count"
      :subjects="subjects"
      :statuses="QUESTION_STATUS_OPTIONS"
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
      caption="Subjektif"
      variant="flush"
      density="compact"
      :loading="list.loading.value && !list.data.value"
      :filtered="chips.length > 0"
      :empty-title="laneCopy.empty"
      card-title="title"
      :card-fields="[{ key: 'no', label: laneCopy.colList }]"
    >
      <template #title-cell="{ row }">
        <DsStack gap="2xs">
          <DsText as="p" variant="body" wrap="anywhere">{{ row.original.title }}</DsText>
          <DsText as="p" variant="caption" tone="muted">{{ row.original.meta }} · {{ statusText(row.original.status) }}</DsText>
        </DsStack>
      </template>
      <template #attention-cell="{ row }">
        <DsStack v-if="row.original.attention.length" gap="2xs" :data-testid="`attention-${row.original.id}`">
          <DsText v-for="a in row.original.attention" :key="a" as="p" variant="caption" tone="error">{{ a }}</DsText>
        </DsStack>
        <DsText v-else variant="caption" tone="muted">{{ laneCopy.noAttention }}</DsText>
      </template>
      <template #card="{ row }">
        <DsStack gap="2xs">
          <DsText as="p" variant="body" wrap="anywhere">{{ row.title }}</DsText>
          <DsText as="p" variant="caption" tone="muted">{{ row.meta }} · {{ statusText(row.status as string) }}</DsText>
          <template v-if="(row.attention as string[]).length">
            <DsText v-for="a in row.attention as string[]" :key="a" as="p" variant="caption" tone="error">{{ a }}</DsText>
          </template>
          <DsText v-else variant="caption" tone="muted">{{ laneCopy.noAttention }}</DsText>
          <DsRowActions :actions="actionsOf(String(row.id))" :inline="2" />
        </DsStack>
      </template>
      <template #actions-cell="{ row }">
        <DsRowActions :actions="actionsOf(row.original.id)" :inline="2" />
      </template>
    </DsDataTable>
  </DsPage>
</template>
