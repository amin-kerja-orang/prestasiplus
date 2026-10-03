<script setup lang="ts">
/**
 * "Prestasi Mengikut Sekolah (Platform + Headcount)" (FN-M12-6.5.1; FR-M12-52; BR-M12-10): # · Sekolah · Pelajar · Aktif ·
 * Ketepatan · Soalan · Engagement · Tahap, by Engagement descending. A school with no active student is faded
 * (`opacity-50`) with "-" for Ketepatan and Soalan; Engagement shows "-" unless the school has a session (940).
 */
import { RouterLink } from 'vue-router'

import { DataTableCard, TABLE_CLASSES as T } from '@/components/data'
import { AppIcon } from '@/components/icon'

import type { ResultsSchoolRow } from '../../../api/types'
import { BAND, count, mean, pct, plain } from '../common/kirkpatrick-format'
import { BAND_FILL } from '../behavior/behavior-format'

defineProps<{ rows: ResultsSchoolRow[]; schoolPath: (id: number) => string }>()

const HEAD = `${T.th} text-center`
const NUM = `${T.td} text-center`
</script>

<template>
  <DataTableCard :min-width="780" data-testid="res-schools">
    <template #header>
      <h2
        class="flex items-center gap-2 px-4 pt-4 font-heading text-base font-bold text-slate-800 sm:px-5"
      >
        <AppIcon name="fa-school" class="h-4 w-4 text-indigo-600" />Prestasi Mengikut Sekolah
        (Platform + Headcount)
      </h2>
    </template>
    <table :class="T.table">
      <thead>
        <tr>
          <th :class="T.th">#</th>
          <th :class="T.th">Sekolah</th>
          <th :class="HEAD">Pelajar</th>
          <th :class="HEAD">Aktif</th>
          <th :class="HEAD">Ketepatan</th>
          <th :class="HEAD">Soalan</th>
          <th :class="HEAD">Engagement</th>
          <th :class="HEAD">Tahap</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(r, i) in rows"
          :key="r.schoolId"
          :class="[T.row, r.faded ? 'opacity-50' : '']"
          :data-faded="r.faded ? 'true' : 'false'"
          data-testid="res-school-row"
        >
          <td :class="`${T.td} text-slate-400`">{{ i + 1 }}</td>
          <td :class="T.td">
            <RouterLink
              :to="schoolPath(r.schoolId)"
              class="font-medium text-indigo-600 hover:underline"
              data-testid="res-school-link"
              >{{ r.name }}</RouterLink
            >
          </td>
          <td :class="NUM" data-testid="cell-students">{{ count(r.students) }}</td>
          <td
            :class="[NUM, 'font-semibold', r.active > 0 ? 'text-green-600' : 'text-slate-300']"
            data-testid="cell-active"
          >
            {{ plain(r.active) }}
          </td>
          <td
            :class="[
              NUM,
              r.accuracy === null
                ? 'text-slate-300'
                : r.accuracy >= 60
                  ? 'text-green-600'
                  : 'text-amber-600',
            ]"
            data-testid="cell-accuracy"
          >
            {{ r.accuracy === null ? '-' : pct(r.accuracy) }}
          </td>
          <td :class="NUM" data-testid="cell-answers">
            {{ r.answers === null ? '-' : count(r.answers) }}
          </td>
          <td :class="[NUM, 'font-bold', BAND[r.tahap].text]" data-testid="cell-engagement">
            {{ r.engagement === null ? '-' : mean(r.engagement) }}
          </td>
          <td :class="NUM">
            <span
              :class="[
                'inline-block rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap text-white',
                BAND_FILL[r.tahap],
              ]"
              data-testid="cell-tahap"
              >{{ BAND[r.tahap].label }}</span
            >
          </td>
        </tr>
      </tbody>
    </table>
  </DataTableCard>
</template>
