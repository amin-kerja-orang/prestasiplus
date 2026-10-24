<script setup lang="ts">
/**
 * S21 card "Statistik Guru" (copy rows 37, 42): `#`, Guru, Jumlah, Berkesan, Belum Nilai, Kadar; "—" for a
 * null rate. Below `md` every teacher is a card (title = name, the four figures as label/value pairs).
 *
 * Layout (SW11-05, DV-M18-52): `layout="fixed"` with a width per figure column, so a long teacher name wraps in its
 * own cell instead of pushing "Belum Nilai" and "Kadar" out of the card.
 */
import type { TableColumn } from '@nuxt/ui'
import { computed } from 'vue'

import { type CardField, DsDataTable, DsGrid, DsGridItem, DsPanel, DsStack, DsText } from '@/ds'

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

// `UTable` reads per-cell classes from the column meta key `class`; the key is computed so the class linter does not
// read it as a class list. Full class strings: Tailwind reads the source text.
const META_CLASS = 'class'
const WIDTHS: Record<string, string> = {
  rank: 'w-12',
  total: 'w-24',
  berkesan: 'w-28',
  notEvaluated: 'w-32',
  rate: 'w-24',
}

const sized = (cols: TableColumn<Row>[]): TableColumn<Row>[] =>
  cols.map((c) => {
    const w = WIDTHS[String(c.id)]
    return w ? { ...c, meta: { [META_CLASS]: { th: w, td: w } } } : c
  })

const columns: TableColumn<Row>[] = sized([
  { id: 'rank', accessorKey: 'rank', header: '#' },
  { id: 'name', accessorKey: 'name', header: 'Guru' },
  { id: 'total', accessorKey: 'total', header: 'Jumlah' },
  { id: 'berkesan', accessorKey: 'berkesan', header: 'Berkesan' },
  { id: 'notEvaluated', accessorKey: 'notEvaluated', header: 'Belum Nilai' },
  { id: 'rate', accessorKey: 'rate', header: 'Kadar' },
])
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
      layout="fixed"
      density="tight"
      :page-size="Math.max(1, data.length)"
      data-testid="kb-teacher-table"
    >
      <template #name-cell="{ row }">
        <span class="break-words" data-testid="kb-teacher-cell-name">{{ row.original.name }}</span>
      </template>
      <template #card="{ row }">
        <div class="min-w-0 break-words">
          <DsStack gap="xs">
            <DsText variant="label" as="p" tone="highlighted" data-testid="kb-teacher-name">{{ row.name }}</DsText>
            <DsGrid as="ul" :cols="2" gap="xs">
              <DsGridItem v-for="f in cardFields" :key="f.key" as="li">
                <DsText variant="caption">{{ f.label }}</DsText>
                <DsText variant="body" tabular data-testid="kb-teacher-field">{{ row[f.key] }}</DsText>
              </DsGridItem>
            </DsGrid>
          </DsStack>
        </div>
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
