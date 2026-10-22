<script setup lang="ts">
/**
 * S23 card "Pecahan Mengikut Sekolah" (admin, scope district / state; design section 8): `#`, Sekolah, Pelajar,
 * Hijau, Kuning, Merah, Prt. Skor, one row per school in the order returned. Below `md` every school is a card.
 */
import type { TableColumn } from '@nuxt/ui'
import { computed } from 'vue'

import { type CardField, DsDataTable, DsGrid, DsGridItem, DsPanel, DsStack, DsText } from '@/ds'
import { formatCount } from '@/lib/number'

import type { AmaranSummaryResponse } from '../../api/amaran'
import { formatAvg } from './ringkasan-format'

const props = defineProps<{ rows: NonNullable<AmaranSummaryResponse['schools']> }>()

interface Row extends Record<string, unknown> {
  rank: string
  school: string
  pupils: string
  green: string
  yellow: string
  red: string
  avgScore: string
}

const data = computed<Row[]>(() =>
  props.rows.map((s, i) => ({
    rank: String(i + 1),
    school: s.school,
    pupils: formatCount(s.pupils),
    green: formatCount(s.green),
    yellow: formatCount(s.yellow),
    red: formatCount(s.red),
    avgScore: formatAvg(s.avgScore),
  })),
)

const columns: TableColumn<Row>[] = [
  { id: 'rank', accessorKey: 'rank', header: '#' },
  { id: 'school', accessorKey: 'school', header: 'Sekolah' },
  { id: 'pupils', accessorKey: 'pupils', header: 'Pelajar' },
  { id: 'green', accessorKey: 'green', header: 'Hijau' },
  { id: 'yellow', accessorKey: 'yellow', header: 'Kuning' },
  { id: 'red', accessorKey: 'red', header: 'Merah' },
  { id: 'avgScore', accessorKey: 'avgScore', header: 'Prt. Skor' },
]
const cardFields: CardField[] = [
  { key: 'pupils', label: 'Pelajar' },
  { key: 'green', label: 'Hijau' },
  { key: 'yellow', label: 'Kuning' },
  { key: 'red', label: 'Merah' },
  { key: 'avgScore', label: 'Prt. Skor' },
]
</script>

<template>
  <DsPanel title="Pecahan Mengikut Sekolah" class="break-inside-avoid" data-testid="rk-schools">
    <DsDataTable
      variant="bare"
      :data="data"
      :columns="columns"
      caption="Pecahan Mengikut Sekolah"
      :card-fields="cardFields"
      :page-size="Math.max(1, data.length)"
      data-testid="rk-schools-table"
    >
      <template #card="{ row }">
        <DsStack gap="xs">
          <DsText variant="label" as="p" tone="highlighted" data-testid="rk-school-name">{{ row.school }}</DsText>
          <DsGrid as="ul" :cols="2" gap="xs">
            <DsGridItem v-for="f in cardFields" :key="f.key" as="li">
              <DsText variant="caption">{{ f.label }}</DsText>
              <DsText variant="body" tabular data-testid="rk-school-field">{{ row[f.key] }}</DsText>
            </DsGridItem>
          </DsGrid>
        </DsStack>
      </template>
    </DsDataTable>
  </DsPanel>
</template>
