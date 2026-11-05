<script setup lang="ts">
/**
 * Lane "Latih Tubi" (`/admin/spm/latih-tubi`, FR-ADM-Q02.4, frame R1-ADM-Q-02): one row per subject x Tingkatan with its servable
 * count and the `latih-tubi` switch as a badge (edited in Kawalan Ciri, N-06). A cell is not a question, so it has no Status filter
 * and no row action (issue S3-T03, decision 4).
 */
import type { TableColumn } from '@nuxt/ui'
import { SERVABILITY_LATIH_TUBI_SWITCH_LABELS, type ServabilityLatihTubiCell } from '@pp/contract'
import { computed } from 'vue'

import { DsDataTable, DsLoadError, DsPage, DsStack, DsStatusBadge, DsText } from '@/ds'

import { kandunganServer } from '../client'
import { laneCopy } from '../lanes'
import { PAGE_SIZE, useLane } from '../use-lane'
import LaneShell from './LaneShell.vue'

type Row = ServabilityLatihTubiCell & { no: number } & Record<string, unknown>

const server = kandunganServer()
const { filters, page, subjects, count, list, chips, removeChip } = useLane((q) => server.latihTubiLane(q), (code) => code)

const rows = computed<Row[]>(() =>
  (list.data.value?.rows ?? []).map((r, i) => ({ ...r, no: (page.value - 1) * PAGE_SIZE + i + 1 })),
)
const columns: TableColumn<Row>[] = [
  { accessorKey: 'no', header: laneCopy.colList },
  { accessorKey: 'title', header: laneCopy.colTitle },
  { accessorKey: 'status', header: laneCopy.colStatus },
  { accessorKey: 'attention', header: laneCopy.colAttention },
]
const badgeOf = (status: unknown): 'active' | 'inactive' => (status === 'open' ? 'active' : 'inactive')
const labelOf = (status: unknown): string => SERVABILITY_LATIH_TUBI_SWITCH_LABELS[status === 'open' ? 'open' : 'closed']
</script>

<template>
  <DsPage layout="list" data-testid="lane-latih-tubi">
    <LaneShell v-model:filters="filters" lane="latih-tubi" :count="count" :subjects="subjects" :chips="chips" @remove-chip="removeChip" />
    <DsLoadError v-if="list.error.value" message="Tidak dapat memuatkan senarai." @retry="list.reload()" />
    <DsDataTable
      v-else
      v-model:page="page"
      :data="rows"
      :columns="columns"
      :total="list.data.value?.total ?? 0"
      :page-size="PAGE_SIZE"
      caption="Latih Tubi"
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
      <template #status-cell="{ row }">
        <DsStatusBadge :status="badgeOf(row.original.status)" :label="labelOf(row.original.status)" />
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
          <DsStatusBadge :status="badgeOf(row.status)" :label="labelOf(row.status)" />
          <template v-if="(row.attention as string[]).length">
            <DsText v-for="a in row.attention as string[]" :key="a" as="p" variant="caption" tone="error">{{ a }}</DsText>
          </template>
          <DsText v-else variant="caption" tone="muted">{{ laneCopy.noAttention }}</DsText>
        </DsStack>
      </template>
    </DsDataTable>
  </DsPage>
</template>
