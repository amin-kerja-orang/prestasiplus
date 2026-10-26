<script setup lang="ts">
/**
 * "Senarai Intervensi" (FN-M12-8.3.1 / 8.3.2; FR-M12-75 / 76): the empty state (icon and one line, DV-M12-01), or the
 * PROPOSED table, newest first (the API order). Staff table (`DsDataTable`: card list below md, inner scroll
 * when wide); the status is a badge with its word.
 */
import { computed, ref } from 'vue'
import type { TableColumn } from '@nuxt/ui'

import { DsDataTable, DsEmptyState, DsPanel } from '@/ds'

import type { InterventionRow, WireId } from '../../../api/types'
import { dateEn, pct } from '../common/kirkpatrick-format'
import { alertLabel, moodLabel, STATUS_COLOR } from './intervention-format'

const props = defineProps<{ rows: InterventionRow[] }>()

/** Slot rows are untyped; this narrows the status for the badge colour. */
const statusColor = (status: unknown) =>
  STATUS_COLOR[status as NonNullable<InterventionRow['status']>]

/** "55.5% · Gembira" / "-" (accuracy then mood, as option labels). */
function accuracyCell(accuracy: number | null, mood: InterventionRow['beforeMood']): string {
  const parts = [accuracy === null ? null : pct(accuracy), moodLabel(mood) || null].filter(
    (p): p is string => p !== null,
  )
  return parts.length > 0 ? parts.join(' · ') : '-'
}

interface Row extends Record<string, unknown> {
  id: WireId
  date: string
  studentId: WireId
  studentName: string | null
  alert: string
  description: string
  action: string
  before: string
  after: string
  status: InterventionRow['status']
}

const data = computed<Row[]>(() =>
  props.rows.map((r) => ({
    id: r.id,
    date: dateEn(r.actionDate),
    studentId: r.studentId,
    studentName: r.studentName,
    alert: alertLabel(r.alertType),
    description: r.alertDescription,
    action: r.actionTaken,
    before: accuracyCell(r.beforeAccuracy, r.beforeMood),
    after: accuracyCell(r.afterAccuracy, r.afterMood),
    status: r.status,
  })),
)

const columns: TableColumn<Row>[] = [
  { accessorKey: 'date', header: 'Tarikh Tindakan' },
  { accessorKey: 'studentId', header: 'Pelajar (ID)' },
  { accessorKey: 'alert', header: 'Jenis Amaran' },
  { accessorKey: 'description', header: 'Penerangan Amaran' },
  { accessorKey: 'action', header: 'Tindakan Diambil' },
  { accessorKey: 'before', header: 'Ketepatan Sebelum (%)' },
  { accessorKey: 'after', header: 'Ketepatan Selepas (%)' },
  { accessorKey: 'status', header: 'Status' },
]
const cardFields = [
  { key: 'alert', label: 'Jenis Amaran' },
  { key: 'description', label: 'Penerangan Amaran' },
  { key: 'action', label: 'Tindakan Diambil' },
  { key: 'before', label: 'Ketepatan Sebelum (%)' },
  { key: 'after', label: 'Ketepatan Selepas (%)' },
  { key: 'status', label: 'Status' },
]

/** Paged at 20 rows. */
const PAGE_SIZES = [10, 20, 50]
const pageSize = ref(20)
</script>

<template>
  <DsPanel title="Senarai Intervensi" icon="i-ph-clipboard-text" data-testid="int-list">
    <UCard v-if="rows.length === 0" data-testid="int-empty">
      <DsEmptyState icon="i-ph-clipboard" title="Tiada intervensi direkodkan lagi." />
    </UCard>
    <DsDataTable
      v-else
      v-model:page-size="pageSize"
      variant="bare"
      :page-size-options="PAGE_SIZES"
      :data="data"
      :columns="columns"
      caption="Senarai intervensi"
      card-title="date"
      :card-fields="cardFields"
    >
      <template #studentId-cell="{ row }">
        <span class="flex flex-col" data-testid="int-row-student">
          <span>{{ row.original.studentId }}</span>
          <span v-if="row.original.studentName" class="text-body text-muted">{{
            row.original.studentName
          }}</span>
        </span>
      </template>
      <template #description-cell="{ row }">
        <span class="block min-w-44 whitespace-normal">{{ row.original.description }}</span>
      </template>
      <template #action-cell="{ row }">
        <span class="block min-w-44 whitespace-normal">{{ row.original.action }}</span>
      </template>
      <template #before-cell="{ row }">
        <span data-testid="int-row-before">{{ row.original.before }}</span>
      </template>
      <template #after-cell="{ row }">
        <span data-testid="int-row-after">{{ row.original.after }}</span>
      </template>
      <template #status-cell="{ row }">
        <UBadge
          v-if="row.original.status"
          :color="statusColor(row.original.status)"
          variant="soft"
          :label="row.original.status"
          data-testid="int-row-status"
        />
      </template>
    </DsDataTable>
  </DsPanel>
</template>
