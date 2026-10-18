<script setup lang="ts">
/** S11 "Indeks Diskriminasi" tab (FR-M08-71…73): the guide, then the table or "Data Tidak Mencukupi". */
import { computed } from 'vue'
import type { TableColumn } from '@nuxt/ui'

import { DsDataTable, DsEmptyState, DsPanel } from '@/ds'
import { formatNumber } from '@/lib/number'

import type { ItemAnalysis } from '../../api/types'
import { usePhIcon } from '../../lib/icons'
import { STATUS_COLOR, indexClass } from '../../lib/prestasi/item-analysis'

const props = defineProps<{ discrimination: ItemAnalysis['discrimination'] }>()

const icon = usePhIcon()

type Status = ItemAnalysis['discrimination']['rows'][number]['status']
const statusColor = (s: Status) => STATUS_COLOR[s]

const GUIDE = [
  { range: '≥ 0.40', label: '= Sangat Baik', color: 'success' },
  { range: '0.30 – 0.39', label: '= Baik', color: 'info' },
  { range: '0.20 – 0.29', label: '= Sederhana', color: 'warning' },
  { range: '< 0.20', label: '= Lemah', color: 'error' },
] as const

type Source = ItemAnalysis['discrimination']['rows'][number]
interface Row extends Record<string, unknown> {
  questionId: number
  index: number
  text: string
  upperText: string
  lowerText: string
  indexValue: number
  indexText: string
  status: Source['status']
}
const rows = computed<Row[]>(() =>
  props.discrimination.rows.map((r, i) => ({
    questionId: r.questionId,
    index: i + 1,
    text: r.text,
    upperText: `${formatNumber(r.upperPct, { decimals: 1 })}% betul`,
    lowerText: `${formatNumber(r.lowerPct, { decimals: 1 })}% betul`,
    indexValue: r.index,
    indexText: r.index.toFixed(3),
    status: r.status,
  })),
)
const columns: TableColumn<Row>[] = [
  { accessorKey: 'index', header: '#' },
  { accessorKey: 'text', header: 'Soalan' },
  { accessorKey: 'upperText', header: 'Kumpulan Atas' },
  { accessorKey: 'lowerText', header: 'Kumpulan Bawah' },
  { accessorKey: 'indexText', header: 'Indeks' },
  { accessorKey: 'status', header: 'Status' },
]
const cardFields = [
  { key: 'upperText', label: 'Kumpulan Atas' },
  { key: 'lowerText', label: 'Kumpulan Bawah' },
  { key: 'indexText', label: 'Indeks' },
  { key: 'status', label: 'Status' },
]
</script>

<template>
  <div class="flex min-w-0 flex-col gap-4" data-testid="discrimination-tab">
    <DsPanel data-testid="discrimination-guide">
      <div class="flex flex-col gap-3">
        <h3 class="flex items-center gap-2 text-subheading text-highlighted">
          <UIcon :name="icon('info')" class="size-5 text-primary" />Panduan Indeks Diskriminasi
        </h3>
        <ul class="flex flex-wrap gap-2">
          <li v-for="g in GUIDE" :key="g.range">
            <UBadge :color="g.color" variant="subtle" size="lg">
              <strong>{{ g.range }}</strong> {{ g.label }}
            </UBadge>
          </li>
        </ul>
        <p class="text-caption text-muted">
          Indeks dikira berdasarkan perbezaan prestasi antara
          <strong>27% pelajar terbaik</strong> dan <strong>27% pelajar bawah</strong> dengan
          menggunakan semua sesi latihan.
        </p>
      </div>
    </DsPanel>

    <DsDataTable
      v-if="discrimination.sufficient"
      :data="rows"
      :columns="columns"
      caption="Indeks diskriminasi soalan"
      card-title="text"
      :card-fields="cardFields"
      :page-size="1000"
      data-testid="discrimination-table"
    >
      <template #text-cell="{ row }">
        <span
          class="line-clamp-2 max-w-sm min-w-44 break-words"
          :data-testid="`discrimination-row-${row.original.questionId}`"
          >{{ row.original.text }}</span
        >
      </template>
      <template #upperText-cell="{ row }">
        <span class="text-success">{{ row.original.upperText }}</span>
      </template>
      <template #lowerText-cell="{ row }">
        <span class="text-error">{{ row.original.lowerText }}</span>
      </template>
      <template #indexText-cell="{ row }">
        <span :class="[indexClass(row.original.indexValue), 'text-label']">{{
          row.original.indexText
        }}</span>
      </template>
      <template #status-cell="{ row }">
        <UBadge
          :color="statusColor(row.original.status)"
          variant="subtle"
          :label="row.original.status"
        />
      </template>
    </DsDataTable>

    <div v-else data-testid="discrimination-insufficient">
      <DsEmptyState
        title="Data Tidak Mencukupi"
        description="Perlu sekurang-kurangnya 4 pelajar dengan sesi latihan selesai untuk mengira indeks diskriminasi."
        icon="i-ph-chart-line-up"
      />
    </div>
  </div>
</template>
