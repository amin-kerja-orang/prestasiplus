<script setup lang="ts">
/**
 * The S23 table (FR-M08-139, BR-M08-08 rule 2 / DV-29): select-all box · # · Nama (→ S15) · TOV ·
 * OTR1 · AR1 … OTR{n} · AR{n} · ETR, each value column with "%" and "Gred" sub-headers, and the last row
 * "Purata Kelas". The table scrolls inside its card. A dropped pupil stays listed, dimmed with the name
 * struck through (INFERRED, so "Kembalikan" can restore it); it is left out of every count and average.
 */
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import { TABLE_CLASSES as T } from '@/components/data'

import type { CellTone, HeadcountDetail } from '../../api/headcount-types'
import { DASH, gradeOfPercent, num1 } from '../../lib/headcount/format'

const props = defineProps<{ detail: HeadcountDetail }>()
const selected = defineModel<number[]>('selected', { required: true })

const otrs = computed(() => Array.from({ length: props.detail.config.activeOtrs }, (_, i) => i))
const allSelected = computed(
  () => props.detail.rows.length > 0 && selected.value.length === props.detail.rows.length,
)

function toggleAll(checked: boolean) {
  selected.value = checked ? props.detail.rows.map((r) => r.userId) : []
}

const AR: Record<CellTone, { cell: string; pill: string }> = {
  above: { cell: 'bg-green-100 text-green-700', pill: 'bg-green-200 text-green-800' },
  on: { cell: 'bg-green-100 text-green-700', pill: 'bg-green-200 text-green-800' },
  below: { cell: 'bg-red-100 text-red-700', pill: 'bg-red-200 text-red-800' },
  na: { cell: 'text-slate-500', pill: 'bg-slate-100 text-slate-500' },
}
const PILL = 'rounded-full px-2 py-0.5 text-xs font-semibold'
const GROUP = 'px-3 py-2 text-center text-xs font-bold uppercase tracking-wide whitespace-nowrap'
const SUB = 'px-3 py-1.5 text-center text-xs font-semibold whitespace-nowrap text-slate-400'
const CELL = 'px-3 py-2.5 text-center text-sm whitespace-nowrap'

const gradeOf = (v: number | null) => (v === null ? null : gradeOfPercent(v))
</script>

<template>
  <table :class="[T.table, 'min-w-[56rem]']" data-testid="headcount-table">
    <thead>
      <tr class="bg-slate-50">
        <th :class="[T.th, 'w-10']" rowspan="2">
          <input
            type="checkbox"
            class="h-4 w-4"
            :checked="allSelected"
            data-testid="select-all"
            @change="toggleAll(($event.target as HTMLInputElement).checked)"
          />
        </th>
        <th :class="T.th" rowspan="2">#</th>
        <th :class="T.th" rowspan="2">Nama</th>
        <th :class="[GROUP, 'bg-amber-50 text-amber-700']" colspan="2">TOV</th>
        <template v-for="i in otrs" :key="i">
          <th :class="[GROUP, 'text-blue-700']" colspan="2">OTR{{ i + 1 }}</th>
          <th :class="[GROUP, 'text-slate-600']" colspan="2">AR{{ i + 1 }}</th>
        </template>
        <th :class="[GROUP, 'text-purple-700']" colspan="2">ETR</th>
      </tr>
      <tr class="bg-slate-50">
        <template v-for="g in 1 + otrs.length * 2 + 1" :key="g">
          <th :class="SUB">%</th>
          <th :class="SUB">Gred</th>
        </template>
      </tr>
    </thead>
    <tbody>
      <tr
        v-for="(r, index) in detail.rows"
        :key="r.userId"
        :class="[T.row, r.dropped ? 'opacity-50' : '']"
        :data-testid="`row-${r.userId}`"
        :data-dropped="r.dropped ? 'true' : 'false'"
      >
        <td :class="CELL">
          <input
            v-model="selected"
            type="checkbox"
            class="h-4 w-4"
            :value="r.userId"
            :data-testid="`select-${r.userId}`"
          />
        </td>
        <td :class="[CELL, 'text-slate-500']">{{ index + 1 }}</td>
        <td :class="[T.td, 'min-w-40 font-semibold']">
          <RouterLink
            :to="`/headcount/student/${r.userId}`"
            :class="['text-indigo-700 hover:underline', r.dropped ? 'line-through' : '']"
            >{{ r.name }}</RouterLink
          >
        </td>
        <td :class="[CELL, 'bg-amber-50 font-semibold text-amber-700']">
          {{ r.tov === null ? DASH : num1(r.tov) }}
        </td>
        <td :class="[CELL, 'bg-amber-50']">
          <span v-if="r.tovGrade" :class="[PILL, 'bg-amber-100 text-amber-700']">{{
            r.tovGrade
          }}</span>
        </td>
        <template v-for="i in otrs" :key="i">
          <td :class="[CELL, 'font-semibold text-blue-700']">
            {{ r.cells[i]?.target == null ? DASH : num1(r.cells[i]!.target!) }}
          </td>
          <td :class="CELL">
            <span v-if="r.cells[i]?.targetGrade" :class="[PILL, 'bg-blue-100 text-blue-600']">{{
              r.cells[i]!.targetGrade
            }}</span>
          </td>
          <td
            :class="[CELL, 'font-semibold', AR[r.cells[i]?.tone ?? 'na'].cell]"
            :data-testid="`ar-${r.userId}-${i + 1}`"
            :data-tone="r.cells[i]?.tone ?? 'na'"
          >
            {{ r.cells[i]?.ar == null ? DASH : num1(r.cells[i]!.ar!) }}
          </td>
          <td :class="[CELL, AR[r.cells[i]?.tone ?? 'na'].cell]">
            <span v-if="r.cells[i]?.arGrade" :class="[PILL, AR[r.cells[i]?.tone ?? 'na'].pill]">{{
              r.cells[i]!.arGrade
            }}</span>
          </td>
        </template>
        <td :class="[CELL, 'font-semibold text-purple-700']">
          {{ r.etr === null ? DASH : num1(r.etr) }}
        </td>
        <td :class="CELL">
          <span v-if="r.etrGrade" :class="[PILL, 'bg-purple-100 text-purple-700']">{{
            r.etrGrade
          }}</span>
        </td>
      </tr>

      <tr class="border-t-2 border-slate-200 bg-slate-50 font-bold" data-testid="average-row">
        <td :class="CELL" />
        <td :class="CELL" />
        <td :class="[T.td, 'font-bold text-slate-700']">Purata Kelas</td>
        <td :class="[CELL, 'text-amber-700']">
          {{ detail.averages.tov === null ? DASH : num1(detail.averages.tov) }}
        </td>
        <td :class="CELL">
          <span
            v-if="gradeOf(detail.averages.tov)"
            :class="[PILL, 'bg-amber-100 text-amber-700']"
            >{{ gradeOf(detail.averages.tov) }}</span
          >
        </td>
        <template v-for="i in otrs" :key="i">
          <td :class="[CELL, 'text-blue-700']">
            {{ detail.averages.otrs[i] == null ? DASH : num1(detail.averages.otrs[i]!) }}
          </td>
          <td :class="CELL">
            <span
              v-if="gradeOf(detail.averages.otrs[i] ?? null)"
              :class="[PILL, 'bg-blue-100 text-blue-600']"
              >{{ gradeOf(detail.averages.otrs[i] ?? null) }}</span
            >
          </td>
          <td :class="[CELL, 'text-slate-700']">
            {{ detail.averages.ars[i] == null ? DASH : num1(detail.averages.ars[i]!) }}
          </td>
          <td :class="CELL">
            <span
              v-if="gradeOf(detail.averages.ars[i] ?? null)"
              :class="[PILL, 'bg-slate-200 text-slate-600']"
              >{{ gradeOf(detail.averages.ars[i] ?? null) }}</span
            >
          </td>
        </template>
        <td :class="[CELL, 'text-purple-700']">
          {{ detail.averages.etr === null ? DASH : num1(detail.averages.etr) }}
        </td>
        <td :class="CELL">
          <span
            v-if="gradeOf(detail.averages.etr)"
            :class="[PILL, 'bg-purple-100 text-purple-700']"
            >{{ gradeOf(detail.averages.etr) }}</span
          >
        </td>
      </tr>
    </tbody>
  </table>
</template>
