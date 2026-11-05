<script setup lang="ts">
/**
 * Kurikulum `DSKP` tab (S4-T02; R1-ADM-C-04, FR-ADM-C04.0, AC-ADM-C04.3; read API-DSKP-11). Mounted by
 * S4-T07 in `CurriculumBrowserPage.vue` (`?tab=dskp`), which passes the GET-form filter as props.
 *
 * - Live counts of Bab, SK, SP and TP per Subjek x Tingkatan and the state `dimuatkan` / `belum dimuatkan`.
 *   Nothing is stored; the rejected rows of a load stay in the loader's CLI report (D115).
 * - With both a subject and a level, the read-only node list (Bidang / SK / SP with TP descriptors).
 * - V3 design-system table (cards on a narrow screen), no new layout.
 */
import type { TableColumn } from '@nuxt/ui'
import { computed } from 'vue'

import { useApi } from '@/composables'
import { type CardField, DsDataTable, DsEmptyState, DsListRow, DsLoadError, DsStack } from '@/ds'

import { fetchDskpReport, type DskpNode, type DskpReportRow } from '../api/admin-curriculum'
import { COPY } from '../lib/subjects-levels'

const props = withDefaults(defineProps<{ subjectId?: string | number | null; levelId?: string | number | null }>(), {
  subjectId: null,
  levelId: null,
})

const { data, error, loading, reload } = useApi(
  (signal) => fetchDskpReport({ subjectId: props.subjectId, levelId: props.levelId }, { signal }),
  () => [props.subjectId, props.levelId],
)

type Row = DskpReportRow & Record<string, unknown> & { key: string; subjectName: string; levelName: string }
const rows = computed<Row[]>(() =>
  (data.value?.rows ?? []).map((r) => ({
    ...r,
    key: `${String(r.subject.id)}-${String(r.level.id)}`,
    subjectName: r.subject.name,
    levelName: r.level.name,
  })),
)

const columns: TableColumn<Row>[] = [
  { accessorKey: 'subjectName', header: 'Subjek' },
  { accessorKey: 'levelName', header: 'Tingkatan' },
  { accessorKey: 'state', header: 'Status' },
  { accessorKey: 'bab', header: 'Bab' },
  { accessorKey: 'sk', header: 'SK' },
  { accessorKey: 'sp', header: 'SP' },
  { accessorKey: 'tp', header: 'TP' },
]
// Below 768 px the table is cards: the state must show there too (FR-ADM-C04.0).
const cardFields: CardField[] = [
  { key: 'levelName', label: 'Tingkatan' },
  { key: 'state', label: 'Status' },
  { key: 'bab', label: 'Bab' },
  { key: 'sk', label: 'SK' },
  { key: 'sp', label: 'SP' },
  { key: 'tp', label: 'TP' },
]

const KIND_LABEL: Record<DskpNode['kind'], string> = { grouping: 'Bidang', unit: 'Bab', sk: 'SK', sp: 'SP' }
const nodes = computed(() => data.value?.nodes ?? null)
</script>

<template>
  <DsStack as="section" gap="md" data-testid="dskp-report-tab">
    <DsLoadError v-if="error" :message="COPY.loadFailed" :error="error" testid="dskp-report-error" @retry="reload()" />

    <template v-else>
      <DsDataTable
        :data="rows"
        :columns="columns"
        :loading="loading && !data"
        caption="DSKP mengikut Subjek dan Tingkatan"
        density="compact"
        :page-size="Math.max(rows.length, 1)"
        card-title="subjectName"
        :card-fields="cardFields"
        data-testid="dskp-report-table"
      >
        <template #state-cell="{ row }">
          <UBadge
            :color="row.original.state === 'dimuatkan' ? 'success' : 'neutral'"
            variant="subtle"
            :label="row.original.state"
            data-testid="dskp-state"
          />
        </template>
      </DsDataTable>

      <DsEmptyState v-if="data && rows.length === 0" item="subjek" :filtered="subjectId !== null || levelId !== null" data-testid="dskp-report-empty" />

      <DsStack v-if="nodes && nodes.length > 0" as="ul" gap="sm" data-testid="dskp-node-list">
        <li v-for="node in nodes" :key="node.id" data-testid="dskp-node">
          <DsListRow :title="`${node.code} ${node.title}`">
            <template #leading>
              <UBadge color="neutral" variant="subtle" :label="KIND_LABEL[node.kind]" />
            </template>
            <template v-if="node.tpDescriptors.length > 0" #sub>
              <span v-for="d in node.tpDescriptors" :key="d.tp" class="block">TP{{ d.tp }}: {{ d.descriptor }}</span>
            </template>
          </DsListRow>
        </li>
      </DsStack>
    </template>
  </DsStack>
</template>
