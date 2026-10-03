<script setup lang="ts">
/**
 * "Senarai Intervensi" (FN-M12-8.3.1 / 8.3.2; FR-M12-75 / 76): the empty state (icon and one line, DV-M12-01), or the
 * PROPOSED table, newest first (the API order), scrolling inside its card.
 */
import { ClipboardCheck, ClipboardList } from '@lucide/vue'

import { DataTableCard, TABLE_CLASSES as T } from '@/components/data'

import type { InterventionRow } from '../../../api/types'
import { dateEn, pct } from '../common/kirkpatrick-format'
import { alertLabel, moodLabel, STATUS_PILL } from './intervention-format'

defineProps<{ rows: InterventionRow[] }>()

/** "55.5% · Gembira" / "-" (accuracy then mood, as option labels). */
function accuracyCell(accuracy: number | null, mood: InterventionRow['beforeMood']): string {
  const parts = [accuracy === null ? null : pct(accuracy), moodLabel(mood) || null].filter(
    (p): p is string => p !== null,
  )
  return parts.length > 0 ? parts.join(' · ') : '-'
}
</script>

<template>
  <DataTableCard :min-width="900" data-testid="int-list">
    <template #header>
      <h2
        class="flex items-center gap-2 px-4 pt-4 font-heading text-sm font-bold text-slate-800 sm:px-5"
      >
        <ClipboardList class="h-4 w-4 text-amber-500" />Senarai Intervensi
      </h2>
    </template>
    <div v-if="rows.length === 0" class="px-4 py-10 text-center" data-testid="int-empty">
      <ClipboardCheck class="mx-auto h-8 w-8 text-slate-300" />
      <p class="mt-2 text-sm text-slate-400">Tiada intervensi direkodkan lagi.</p>
    </div>
    <table v-else :class="T.table">
      <thead>
        <tr>
          <th :class="T.th">Tarikh Tindakan</th>
          <th :class="T.th">Pelajar (ID)</th>
          <th :class="T.th">Jenis Amaran</th>
          <th :class="T.th">Penerangan Amaran</th>
          <th :class="T.th">Tindakan Diambil</th>
          <th :class="T.th">Ketepatan Sebelum (%)</th>
          <th :class="T.th">Ketepatan Selepas (%)</th>
          <th :class="T.th">Status</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="r in rows" :key="r.id" :class="T.row" data-testid="int-row">
          <td :class="`${T.td} whitespace-nowrap`">{{ dateEn(r.actionDate) }}</td>
          <td :class="T.td" data-testid="int-row-student">
            {{ r.studentId }}
            <span v-if="r.studentName" class="block text-xs text-slate-400">{{
              r.studentName
            }}</span>
          </td>
          <td :class="T.td">{{ alertLabel(r.alertType) }}</td>
          <td :class="`${T.td} min-w-44`">{{ r.alertDescription }}</td>
          <td :class="`${T.td} min-w-44`">{{ r.actionTaken }}</td>
          <td :class="T.td" data-testid="int-row-before">
            {{ accuracyCell(r.beforeAccuracy, r.beforeMood) }}
          </td>
          <td :class="T.td" data-testid="int-row-after">
            {{ accuracyCell(r.afterAccuracy, r.afterMood) }}
          </td>
          <td :class="T.td">
            <span
              v-if="r.status"
              :class="[
                'inline-block rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap',
                STATUS_PILL[r.status],
              ]"
              data-testid="int-row-status"
              >{{ r.status }}</span
            >
          </td>
        </tr>
      </tbody>
    </table>
  </DataTableCard>
</template>
