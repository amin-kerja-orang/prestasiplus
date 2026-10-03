<script setup lang="ts">
/**
 * "GPS Mengikut Subjek ({tahun})" (FN-M12-6.3.1; FR-M12-50; BR-M12-19): # · Subjek · GPS · Gred · Calon · Trend, by GPS
 * ascending. The subject cell is plain text with the default cursor and no title (DV-M12-05). The same platform
 * rows show in every scope (DV-M12-26). The table scrolls inside its card.
 */
import { computed } from 'vue'

import { DataTableCard, TABLE_CLASSES as T } from '@/components/data'
import { AppIcon } from '@/components/icon'

import { gps } from '../common/kirkpatrick-format'
import type { ResultsSubjectGps } from './results-types'

const props = defineProps<{ subjectGps: ResultsSubjectGps }>()

const rows = computed(() => [...props.subjectGps.rows].sort((a, b) => a.gps - b.gps))
const HEAD = `${T.th} text-center`
const NUM = `${T.td} text-center`
</script>

<template>
  <DataTableCard :min-width="520" data-testid="res-subject-gps">
    <template #header>
      <h2
        class="flex items-center gap-2 px-4 pt-4 font-heading text-base font-bold text-slate-800 sm:px-5"
      >
        <AppIcon name="fa-book" class="h-4 w-4 text-green-600" />GPS Mengikut Subjek ({{
          subjectGps.year
        }})
      </h2>
    </template>
    <table :class="T.table">
      <thead>
        <tr>
          <th :class="T.th">#</th>
          <th :class="T.th">Subjek</th>
          <th :class="HEAD">GPS</th>
          <th :class="HEAD">Gred</th>
          <th :class="HEAD">Calon</th>
          <th :class="HEAD">Trend</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(r, i) in rows" :key="r.name" :class="T.row" data-testid="res-subject-row">
          <td :class="`${T.td} text-slate-400`">{{ i + 1 }}</td>
          <td
            :class="`${T.td} cursor-default font-medium text-slate-700`"
            data-testid="cell-subject"
          >
            {{ r.name }}
          </td>
          <td :class="`${NUM} font-bold text-green-600`" data-testid="cell-gps">
            {{ gps(r.gps) }}
          </td>
          <td :class="`${NUM} font-semibold`" data-testid="cell-grade">{{ r.grade }}</td>
          <td :class="NUM" data-testid="cell-candidates">{{ r.candidates }}</td>
          <td :class="NUM" data-testid="cell-trend">
            <span
              v-if="r.prev !== null"
              :class="[
                'inline-flex items-center gap-1 text-xs',
                r.gps > r.prev ? 'text-red-500' : 'text-green-500',
              ]"
            >
              <AppIcon
                :name="r.gps > r.prev ? 'fa-arrow-down' : 'fa-arrow-up'"
                class="h-3.5 w-3.5"
              />
              <span class="text-slate-400">{{ gps(r.prev) }}</span>
            </span>
          </td>
        </tr>
      </tbody>
    </table>
    <template #footer>
      <p class="flex items-center gap-1.5 px-4 pb-4 text-xs text-slate-400 sm:px-5">
        <AppIcon name="fa-info-circle" class="h-3.5 w-3.5 shrink-0" />GPS rendah = lebih baik.
        Trend: berbanding tahun sebelumnya.
      </p>
    </template>
  </DataTableCard>
</template>
