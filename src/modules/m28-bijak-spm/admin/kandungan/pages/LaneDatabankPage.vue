<script setup lang="ts">
/**
 * Lane "Databank Soalan" (`/admin/spm/databank`, V2 A2/P2, AC-R1-21.2): one bank question per row. Columns Senarai, Tajuk,
 * Perhatian, Tindakan. `Perhatian` shows the servability reasons (D94 copy, H2), not the V2 phrases. Row action: Sunting.
 * Pratonton is not a separate screen in R1 (the Bank page previews in a dialog), so it is not offered here (UX-23).
 */
import type { TableColumn } from '@nuxt/ui'
import { computed } from 'vue'

import { DsDataTable, DsLoadError } from '@/ds'

import { ADMIN_ROUTES } from '../../papers/ui'
import { kandunganServer } from '../client'
import { laneCopy } from '../lanes'
import { PAGE_SIZE, useLane } from '../use-lane'
import LaneShell from './LaneShell.vue'

import type { ServabilityDatabankRow } from '@pp/contract'

type Row = ServabilityDatabankRow & { no: number } & Record<string, unknown>

const STATUSES = [
  { value: 'draft', label: 'Draf' },
  { value: 'review', label: 'Menunggu Semakan' },
  { value: 'approved', label: 'Diterbitkan' },
  { value: 'archived', label: 'Diarkibkan' },
]
const statusText = (code: string): string => STATUSES.find((s) => s.value === code)?.label ?? code

const server = kandunganServer()
const { filters, page, subjects, list, chips, removeChip } = useLane(server, (q) => server.databankLane(q), statusText)

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
  <LaneShell
    v-model:filters="filters"
    heading="Databank Soalan"
    :subjects="subjects"
    :statuses="STATUSES"
    :chips="chips"
    testid="lane-databank"
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
      caption="Databank Soalan"
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
          <p class="text-caption text-muted">
            {{ row.original.subject?.name ?? '' }} · {{ statusText(row.original.status) }}
          </p>
        </div>
      </template>
      <template #attention-cell="{ row }">
        <ul v-if="row.original.attention.length" class="flex flex-col gap-1" :data-testid="`attention-${row.original.questionId}`">
          <li v-for="a in row.original.attention" :key="a.code" class="text-caption text-error">{{ a.message }}</li>
        </ul>
      </template>
      <template #card="{ row }">
        <div class="flex min-w-0 flex-1 flex-col gap-1">
          <p class="break-words text-body">{{ row.title }}</p>
          <p class="text-caption text-muted">{{ row.subject?.name ?? '' }} · {{ statusText(row.status as string) }}</p>
          <ul v-if="(row.attention as unknown[]).length" class="flex flex-col gap-1">
            <li
              v-for="a in row.attention as { code: string; message: string }[]"
              :key="a.code"
              class="text-caption text-error"
            >
              {{ a.message }}
            </li>
          </ul>
        </div>
      </template>
      <template #card-actions="{ row }">
        <UButton
          size="sm"
          icon="i-ph-pencil-simple"
          :label="laneCopy.edit"
          class="min-h-11"
          :to="{ name: ADMIN_ROUTES.bankEdit, params: { qid: row.questionId } }"
          :data-testid="`lane-edit-${String(row.questionId)}`"
        />
      </template>
      <template #actions-cell="{ row }">
        <UButton
          size="sm"
          icon="i-ph-pencil-simple"
          :label="laneCopy.edit"
          class="min-h-11"
          :to="{ name: ADMIN_ROUTES.bankEdit, params: { qid: row.original.questionId } }"
          :data-testid="`lane-edit-${row.original.questionId}`"
        />
      </template>
    </DsDataTable>
  </LaneShell>
</template>
