<script setup lang="ts">
/**
 * "Ramalan ALESA (Predictive Grade)" (FN-M12-6.7.1 ... 6.7.4; FR-M12-54 ... 57; BR-M12-22): visible heading icon (DV-M12-06), three
 * tiles and the footer computed by the API from the listed rows, the stored rows by grade, Keyakinan pills and the
 * Cadangan text of the stored band. The table scrolls inside its card.
 */
import { DataTableCard, TABLE_CLASSES as T } from '@/components/data'
import { AppIcon } from '@/components/icon'

import type { Results } from '../../../api/types'
import { CARD, pct, plain } from '../common/kirkpatrick-format'
import { CADANGAN, CONFIDENCE, GRADE_FILL } from './results-format'

defineProps<{ alesa: Results['alesa'] }>()

const HEAD = `${T.th} text-center`
</script>

<template>
  <section :class="[CARD, 'min-w-0 overflow-hidden']" data-testid="res-alesa">
    <div class="px-4 pt-4 sm:px-5">
      <h2 class="flex items-center gap-2 font-heading text-base font-bold text-slate-800">
        <AppIcon
          name="fa-crystal-ball"
          class="h-5 w-5 text-purple-600"
          data-testid="alesa-icon"
        />Ramalan ALESA (Predictive Grade)
      </h2>
      <p class="text-xs text-slate-400">
        Berdasarkan ketepatan, konsistensi, trend mingguan, dan jumlah latihan pelajar
      </p>
      <div class="mt-3 grid grid-cols-3 gap-2 sm:gap-3">
        <div
          class="min-w-0 rounded-xl bg-green-50 p-2 text-center sm:p-3"
          data-testid="alesa-lulus"
        >
          <p
            class="font-heading text-xl font-bold text-green-700 sm:text-2xl"
            data-testid="tile-value"
          >
            {{ plain(alesa.lulus) }}
          </p>
          <p class="text-xs text-green-600">Dijangka Lulus</p>
        </div>
        <div class="min-w-0 rounded-xl bg-red-50 p-2 text-center sm:p-3" data-testid="alesa-gagal">
          <p
            class="font-heading text-xl font-bold text-red-700 sm:text-2xl"
            data-testid="tile-value"
          >
            {{ plain(alesa.gagal) }}
          </p>
          <p class="text-xs text-red-600">Dijangka Gagal</p>
        </div>
        <div
          class="min-w-0 rounded-xl bg-amber-50 p-2 text-center sm:p-3"
          data-testid="alesa-intervensi"
        >
          <p
            class="font-heading text-xl font-bold text-amber-700 sm:text-2xl"
            data-testid="tile-value"
          >
            {{ plain(alesa.intervensi) }}
          </p>
          <p class="text-xs text-amber-600">Perlu Intervensi</p>
        </div>
      </div>
    </div>
    <DataTableCard :min-width="780" class="!rounded-none !border-0 !shadow-none">
      <table :class="T.table" class="mt-2">
        <thead>
          <tr>
            <th :class="T.th">#</th>
            <th :class="T.th">Pelajar</th>
            <th :class="HEAD">Ketepatan</th>
            <th :class="HEAD">Ramalan Gred</th>
            <th :class="HEAD">Keyakinan</th>
            <th :class="T.th">Cadangan</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(r, i) in alesa.rows" :key="r.userId" :class="T.row" data-testid="alesa-row">
            <td :class="`${T.td} text-slate-400`">{{ i + 1 }}</td>
            <td :class="T.td">
              <span class="block font-medium text-slate-700" data-testid="alesa-name">{{
                r.name
              }}</span>
              <span class="block text-xs text-slate-400">{{ r.schoolName }}</span>
            </td>
            <td :class="`${T.td} text-center font-semibold text-slate-700`">
              {{ pct(r.accuracy) }}
            </td>
            <td :class="`${T.td} text-center`">
              <span
                :class="[
                  'inline-block min-w-8 rounded-full px-2 py-0.5 text-xs font-bold text-white',
                  GRADE_FILL[r.grade],
                ]"
                data-testid="alesa-grade"
                >{{ r.grade }}</span
              >
            </td>
            <td :class="`${T.td} text-center`">
              <span
                :class="[
                  'inline-block rounded-full px-2 py-0.5 text-xs font-medium',
                  CONFIDENCE[r.confidence].cls,
                ]"
                data-testid="alesa-confidence"
                >{{ CONFIDENCE[r.confidence].label }}</span
              >
            </td>
            <td :class="`${T.td} min-w-56 text-xs`" data-testid="alesa-cadangan">
              {{ CADANGAN[r.cadanganBand] }}
            </td>
          </tr>
        </tbody>
      </table>
    </DataTableCard>
    <p
      class="m-4 flex items-start gap-2 rounded-lg bg-purple-50 p-3 text-xs text-purple-700 sm:mx-5"
      data-testid="alesa-footer"
    >
      <AppIcon name="fa-info-circle" class="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span
        ><strong>{{ plain(alesa.lulus) }} pelajar dijangka lulus</strong>,
        {{ plain(alesa.intervensi) }} pelajar perlu intervensi segera. Ramalan ini berdasarkan
        formula berwajaran: Ketepatan (40%), Konsistensi (20%), Trend (20%), Volume (20%).</span
      >
    </p>
  </section>
</template>
