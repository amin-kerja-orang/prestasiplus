<script setup lang="ts">
/** S11 "Indeks Diskriminasi" tab (FR-M08-71…73): the guide, then the table or "Data Tidak Mencukupi". */
import { ChartLine, Info } from '@lucide/vue'

import { DataTableCard, TABLE_CLASSES as T } from '@/components/data'
import { formatNumber } from '@/lib/number'

import type { ItemAnalysis } from '../../api/types'
import { STATUS_PILL, indexClass } from '../../lib/prestasi/item-analysis'

defineProps<{ discrimination: ItemAnalysis['discrimination'] }>()

const GUIDE = [
  { range: '≥ 0.40', label: '= Sangat Baik', style: 'background: #dcfce7; color: #166534' },
  { range: '0.30 – 0.39', label: '= Baik', style: 'background: #d1fae5; color: #065f46' },
  { range: '0.20 – 0.29', label: '= Sederhana', style: 'background: #fef3c7; color: #92400e' },
  { range: '< 0.20', label: '= Lemah', style: 'background: #fee2e2; color: #991b1b' },
]
</script>

<template>
  <div class="space-y-4" data-testid="discrimination-tab">
    <section class="rounded-2xl bg-white p-4 shadow" data-testid="discrimination-guide">
      <h3 class="mb-2 flex items-center gap-2 text-sm font-bold text-slate-800">
        <Info class="h-4 w-4 text-indigo-500" />Panduan Indeks Diskriminasi
      </h3>
      <div class="flex flex-wrap gap-2">
        <span
          v-for="g in GUIDE"
          :key="g.range"
          class="rounded-full px-3 py-1 text-xs"
          :style="g.style"
          ><strong>{{ g.range }}</strong> {{ g.label }}</span
        >
      </div>
      <p class="mt-3 text-xs text-slate-500">
        Indeks dikira berdasarkan perbezaan prestasi antara <strong>27% pelajar terbaik</strong> dan
        <strong>27% pelajar bawah</strong> dengan menggunakan semua sesi latihan.
      </p>
    </section>

    <DataTableCard v-if="discrimination.sufficient" :min-width="560">
      <table :class="T.table" data-testid="discrimination-table">
        <thead>
          <tr>
            <th :class="T.th">#</th>
            <th :class="T.th">Soalan</th>
            <th :class="[T.th, 'text-center']">Kumpulan Atas</th>
            <th :class="[T.th, 'text-center']">Kumpulan Bawah</th>
            <th :class="[T.th, 'text-center']">Indeks</th>
            <th :class="[T.th, 'text-center']">Status</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(r, i) in discrimination.rows"
            :key="r.questionId"
            :class="T.row"
            :data-testid="`discrimination-row-${r.questionId}`"
          >
            <td :class="[T.td, 'text-slate-400']">{{ i + 1 }}</td>
            <td :class="[T.td, 'max-w-xs min-w-44']">
              <span class="line-clamp-2 break-words">{{ r.text }}</span>
            </td>
            <td :class="[T.td, 'text-center text-green-700']">
              {{ formatNumber(r.upperPct, { decimals: 1 }) }}% betul
            </td>
            <td :class="[T.td, 'text-center text-red-700']">
              {{ formatNumber(r.lowerPct, { decimals: 1 }) }}% betul
            </td>
            <td :class="[T.td, 'text-center font-mono font-semibold', indexClass(r.index)]">
              {{ r.index.toFixed(3) }}
            </td>
            <td :class="[T.td, 'text-center']">
              <span
                :class="['rounded-full px-2.5 py-0.5 text-xs font-semibold', STATUS_PILL[r.status]]"
                >{{ r.status }}</span
              >
            </td>
          </tr>
        </tbody>
      </table>
    </DataTableCard>

    <section
      v-else
      class="rounded-2xl bg-white py-10 text-center shadow"
      data-testid="discrimination-insufficient"
    >
      <ChartLine class="mx-auto h-12 w-12 text-slate-300" />
      <h3 class="mt-3 text-lg font-bold text-slate-800">Data Tidak Mencukupi</h3>
      <p class="mx-auto mt-1 max-w-md text-sm text-slate-500">
        Perlu sekurang-kurangnya 4 pelajar dengan sesi latihan selesai untuk mengira indeks
        diskriminasi.
      </p>
    </section>
  </div>
</template>
