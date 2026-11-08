<script setup lang="ts">
/**
 * Lane "Tracking A" (`/admin/spm/tracking-a`, FR-ADM-Q17.1, frame R1-ADM-Q-02): one row per set, read from the lane read (API-BIJAK-12, D-8) in set
 * number order. `Perhatian` shows "Hanya {a} daripada {b} soalan", "—" when the set is complete. No Status filter on this lane. `Sunting` opens the
 * editor; `Tambah Set` opens the editor's form (D-21), the only way in while no set exists.
 */
import type { TableColumn } from '@nuxt/ui'
import type { ServabilityLaneRow } from '@pp/contract'
import { computed } from 'vue'

import { DsCluster, DsDataTable, DsLoadError, DsPage, DsRowActions, DsStack, DsText, type RowAction } from '@/ds'

import { KANDUNGAN_ROUTES, TRACKING_NEW_SET } from '../api'
import { kandunganServer } from '../client'
import { laneCopy } from '../lanes'
import { PAGE_SIZE, useLane } from '../use-lane'
import LaneShell from './LaneShell.vue'

type Row = ServabilityLaneRow & { no: number } & Record<string, unknown>

const editorOf = (set: string) => ({ name: KANDUNGAN_ROUTES.trackingAEdit, params: { set } })
const actionsOf = (id: string): RowAction[] => [{ label: laneCopy.edit, testid: `lane-edit-${id}`, to: editorOf(id) }]
const addTo = editorOf(TRACKING_NEW_SET)

const server = kandunganServer()
const { filters, page, subjects, count, list, chips, removeChip } = useLane((q) => server.trackingLane(q), (code) => code)

const rows = computed<Row[]>(() => (list.data.value?.rows ?? []).map((r, i) => ({ ...r, no: (page.value - 1) * PAGE_SIZE + i + 1 })))
const columns: TableColumn<Row>[] = [
  { accessorKey: 'no', header: laneCopy.colList },
  { accessorKey: 'title', header: laneCopy.colTitle },
  { accessorKey: 'attention', header: laneCopy.colAttention },
  { id: 'actions', header: laneCopy.colActions },
]
</script>

<template>
  <DsPage layout="list" data-testid="lane-tracking-a">
    <LaneShell v-model:filters="filters" lane="tracking-a" :count="count" :subjects="subjects" :chips="chips" @remove-chip="removeChip" />
    <DsCluster gap="xs">
      <UButton label="Tambah Set" :to="addTo" data-testid="tracking-add" />
    </DsCluster>
    <DsLoadError v-if="list.error.value" message="Tidak dapat memuatkan senarai." @retry="list.reload()" />
    <DsDataTable
      v-else
      v-model:page="page"
      :data="rows"
      :columns="columns"
      :total="list.data.value?.total ?? 0"
      :page-size="PAGE_SIZE"
      caption="Tracking A"
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
          <DsText as="p" variant="caption" tone="muted">{{ row.original.meta }}</DsText>
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
          <DsText as="p" variant="caption" tone="muted">{{ row.meta }}</DsText>
          <template v-if="(row.attention as string[]).length">
            <DsText v-for="a in row.attention as string[]" :key="a" as="p" variant="caption" tone="error">{{ a }}</DsText>
          </template>
          <DsText v-else variant="caption" tone="muted">{{ laneCopy.noAttention }}</DsText>
          <DsRowActions :actions="actionsOf(String(row.id))" :inline="1" />
        </DsStack>
      </template>
      <template #actions-cell="{ row }">
        <DsRowActions :actions="actionsOf(row.original.id)" :inline="1" />
      </template>
    </DsDataTable>
  </DsPage>
</template>
