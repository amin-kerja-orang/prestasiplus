<script setup lang="ts">
/**
 * S5 card "Statistik Bulanan" (FR-M27-84; BR-M27-28): subtitle "12 bulan terakhir — pecahan prestasi
 * mengikut bulan"; columns "Bulan", "Soalan Dijawab", "Soalan Betul", "Pelajar Aktif", "Purata/Pelajar",
 * "Accuracy"; one row per month with a completed session; with more than one row the footer "Jumlah".
 * Empty: "Tiada data" / "Tiada aktiviti direkodkan buat masa ini". The table scrolls inside its card.
 */
import { DataTableCard, TABLE_CLASSES as T } from '@/components/data'

import type { MonthlyReport } from '../../api/school-admin'
import { count, dec1, NO_DATA, pct1 } from './monthly-format'

defineProps<{ months: MonthlyReport['months']; total: MonthlyReport['total'] }>()

const NUM = 'text-right whitespace-nowrap'
</script>

<template>
  <DataTableCard :min-width="months.length > 0 ? 560 : undefined">
    <template #header>
      <div class="px-4 pt-4 sm:px-5">
        <h2 class="text-sm font-bold text-slate-700" data-testid="lb-table-title">
          Statistik Bulanan
        </h2>
        <p class="text-xs text-slate-500" data-testid="lb-table-subtitle">
          12 bulan terakhir — pecahan prestasi mengikut bulan
        </p>
      </div>
    </template>

    <p
      v-if="months.length === 0"
      class="px-4 py-8 text-center sm:px-5"
      data-testid="lb-table-empty"
    >
      <span class="block text-sm font-semibold text-slate-700">Tiada data</span>
      <span class="block text-sm text-slate-500">Tiada aktiviti direkodkan buat masa ini</span>
    </p>
    <table v-else :class="[T.table, 'mt-3']" data-testid="lb-table">
      <thead>
        <tr>
          <th :class="T.th">Bulan</th>
          <th :class="[T.th, NUM]">Soalan Dijawab</th>
          <th :class="[T.th, NUM]">Soalan Betul</th>
          <th :class="[T.th, NUM]">Pelajar Aktif</th>
          <th :class="[T.th, NUM]">Purata/Pelajar</th>
          <th :class="[T.th, NUM]">Accuracy</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="m in months" :key="m.month" :class="T.row" data-testid="lb-table-row">
          <td :class="[T.td, 'whitespace-nowrap']">{{ m.label }}</td>
          <td :class="[T.td, NUM]">{{ count(m.answers) }}</td>
          <td :class="[T.td, NUM]">{{ count(m.correct) }}</td>
          <td :class="[T.td, NUM]">{{ count(m.activePupils) }}</td>
          <td :class="[T.td, NUM]">{{ dec1(m.perPupil) }}</td>
          <td :class="[T.td, NUM]">{{ pct1(m.accuracy) }}</td>
        </tr>
      </tbody>
      <tfoot v-if="months.length > 1 && total">
        <tr :class="[T.row, 'bg-slate-50 font-bold']" data-testid="lb-table-total">
          <td :class="T.td">Jumlah</td>
          <td :class="[T.td, NUM]">{{ count(total.answers) }}</td>
          <td :class="[T.td, NUM]">{{ count(total.correct) }}</td>
          <td :class="[T.td, NUM]">{{ NO_DATA }}</td>
          <td :class="[T.td, NUM]">{{ NO_DATA }}</td>
          <td :class="[T.td, NUM]">{{ pct1(total.accuracy) }}</td>
        </tr>
      </tfoot>
    </table>
  </DataTableCard>
</template>
