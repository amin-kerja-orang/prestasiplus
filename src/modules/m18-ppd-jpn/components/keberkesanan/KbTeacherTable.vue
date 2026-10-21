<script setup lang="ts">
/**
 * S21 card "Statistik Guru" (copy rows 37, 42): `#`, Guru, Jumlah, Berkesan, Belum Nilai, Kadar; "—" for a
 * null rate. Below `md` every teacher is a card (title = name, the four figures as label/value pairs).
 */
import type { TableColumn } from '@nuxt/ui'
import { computed } from 'vue'

import { DsDataTable, DsPanel, type CardField } from '@/ds'

import type { AmaranEffectivenessReportView } from '../../api/amaran'
import { count, rateText } from './kb-format'

const props = defineProps<{ rows: AmaranEffectivenessReportView['byTeacher'] }>()

interface Row extends Record<string, unknown> {
  rank: string
  name: string
  total: string
  berkesan: string
  notEvaluated: string
  rate: string
}

const data = computed<Row[]>(() =>
  props.rows.map((t, i) => ({
    rank: String(i + 1),
    name: t.name,
    total: count(t.total),
    berkesan: count(t.berkesan),
    notEvaluated: count(t.notEvaluated),
    rate: rateText(t.rate),
  })),
)

const columns: TableColumn<Row>[] = [
  { id: 'rank', accessorKey: 'rank', header: '#' },
  { id: 'name', accessorKey: 'name', header: 'Guru' },
  { id: 'total', accessorKey: 'total', header: 'Jumlah' },
  { id: 'berkesan', accessorKey: 'berkesan', header: 'Berkesan' },
  { id: 'notEvaluated', accessorKey: 'notEvaluated', header: 'Belum Nilai' },
  { id: 'rate', accessorKey: 'rate', header: 'Kadar' },
]
const cardFields: CardField[] = [
  { key: 'total', label: 'Jumlah' },
  { key: 'berkesan', label: 'Berkesan' },
  { key: 'notEvaluated', label: 'Belum Nilai' },
  { key: 'rate', label: 'Kadar' },
]
</script>

<template>
  <DsPanel title="Statistik Guru" data-testid="kb-teachers">
    <DsDataTable
      variant="bare"
      :data="data"
      :columns="columns"
      caption="Statistik Guru"
      :card-fields="cardFields"
      :page-size="Math.max(1, data.length)"
      data-testid="kb-teacher-table"
    >
      <template #card="{ row }">
        <p class="text-label text-highlighted" data-testid="kb-teacher-name">{{ row.name }}</p>
        <dl class="grid grid-cols-2 gap-x-3 gap-y-1">
          <div v-for="f in cardFields" :key="f.key" class="min-w-0">
            <dt class="text-caption text-muted">{{ f.label }}</dt>
            <dd class="tabular text-body" data-testid="kb-teacher-field">{{ row[f.key] }}</dd>
          </div>
        </dl>
      </template>
      <template #berkesan-cell="{ row }">
        <UBadge color="success" variant="subtle">{{ row.original.berkesan }}</UBadge>
      </template>
      <template #notEvaluated-cell="{ row }">
        <UBadge color="neutral" variant="subtle">{{ row.original.notEvaluated }}</UBadge>
      </template>
    </DsDataTable>
  </DsPanel>
</template>
