<script setup lang="ts">
/**
 * S4 "Statistik Bulanan" (restyle spec AS-50): `DsDataTable` with Bulan, Soalan Dijawab, Soalan Betul,
 * Pelajar Aktif, Purata/Pelajar and Accuracy, one row per month (newest first as the server sends them).
 * With more than one month the "Jumlah" row closes the table. No month at all: "Tiada data" and
 * "Tiada aktiviti direkodkan buat masa ini". Below `md` every month is a card.
 */
import type { TableColumn } from '@nuxt/ui'
import { computed } from 'vue'

import { DsDataTable, type CardField } from '@/ds'

import type { MonthlyReport } from '../../api/school-admin'
import { count, dec1, NO_DATA, pct1 } from './monthly-format'

const props = defineProps<{ months: MonthlyReport['months']; total: MonthlyReport['total'] }>()

interface Row extends Record<string, unknown> {
  month: string
  answers: string
  correct: string
  active: string
  perPupil: string
  accuracy: string
}

const rows = computed<Row[]>(() => {
  const list: Row[] = props.months.map((m) => ({
    month: m.label,
    answers: count(m.answers),
    correct: count(m.correct),
    active: count(m.activePupils),
    perPupil: dec1(m.perPupil),
    accuracy: pct1(m.accuracy),
  }))
  if (props.months.length > 1 && props.total) {
    list.push({
      month: 'Jumlah',
      answers: count(props.total.answers),
      correct: count(props.total.correct),
      active: NO_DATA,
      perPupil: NO_DATA,
      accuracy: pct1(props.total.accuracy),
    })
  }
  return list
})

const columns: TableColumn<Row>[] = [
  { accessorKey: 'month', header: 'Bulan' },
  { accessorKey: 'answers', header: 'Soalan Dijawab' },
  { accessorKey: 'correct', header: 'Soalan Betul' },
  { accessorKey: 'active', header: 'Pelajar Aktif' },
  { accessorKey: 'perPupil', header: 'Purata/Pelajar' },
  { accessorKey: 'accuracy', header: 'Accuracy' },
]
const cardFields: CardField[] = [
  { key: 'answers', label: 'Soalan Dijawab' },
  { key: 'correct', label: 'Soalan Betul' },
  { key: 'active', label: 'Pelajar Aktif' },
  { key: 'perPupil', label: 'Purata/Pelajar' },
  { key: 'accuracy', label: 'Accuracy' },
]
</script>

<template>
  <section class="flex min-w-0 flex-col gap-3" data-testid="lb-table-section">
    <div>
      <h2 class="text-subheading text-highlighted" data-testid="lb-table-title">
        Statistik Bulanan
      </h2>
      <p class="text-caption text-muted" data-testid="lb-table-subtitle">
        12 bulan terakhir — pecahan prestasi mengikut bulan
      </p>
    </div>
    <UCard v-if="months.length === 0" data-testid="lb-table-empty">
      <p class="py-4 text-center">
        <span class="block text-label text-highlighted">Tiada data</span>
        <span class="block text-body text-muted">Tiada aktiviti direkodkan buat masa ini</span>
      </p>
    </UCard>
    <DsDataTable
      v-else
      :data="rows"
      :columns="columns"
      caption="Statistik bulanan"
      card-title="month"
      :card-fields="cardFields"
      :page-size="rows.length"
      data-testid="lb-table"
    />
  </section>
</template>
