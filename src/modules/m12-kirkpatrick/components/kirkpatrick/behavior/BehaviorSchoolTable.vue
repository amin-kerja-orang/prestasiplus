<script setup lang="ts">
/**
 * "Engagement Mengikut Sekolah" (FN-M12-5.4.1; FR-M12-44; BR-M12-11/12): # · Sekolah (link + code line) ·
 * Pelajar · Aktif · Soalan · Sesi · Purata/Aktif · Skor · Tahap; the table scrolls inside its card.
 */
import { RouterLink } from 'vue-router'

import { DataTableCard, TABLE_CLASSES as T } from '@/components/data'
import { AppIcon } from '@/components/icon'

import type { BehaviorSchoolRow } from '../../../api/types'
import { BAND, count, mean, plain } from '../common/kirkpatrick-format'
import { BAND_FILL } from './behavior-format'

defineProps<{ rows: BehaviorSchoolRow[]; schoolPath: (id: number) => string }>()

const NUM = `${T.td} text-center`
const HEAD = `${T.th} text-center`
</script>

<template>
  <DataTableCard :min-width="820" data-testid="beh-schools">
    <template #header>
      <h2
        class="flex items-center gap-2 px-4 pt-4 font-heading text-base font-bold text-slate-800 sm:px-5"
      >
        <AppIcon name="fa-school" class="h-4 w-4 text-indigo-600" />Engagement Mengikut Sekolah
      </h2>
    </template>
    <table :class="T.table">
      <thead>
        <tr>
          <th :class="T.th">#</th>
          <th :class="T.th">Sekolah</th>
          <th :class="HEAD">Pelajar</th>
          <th :class="HEAD">Aktif</th>
          <th :class="HEAD">Soalan</th>
          <th :class="HEAD">Sesi</th>
          <th :class="HEAD">Purata/Aktif</th>
          <th :class="HEAD">Skor</th>
          <th :class="HEAD">Tahap</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(r, i) in rows" :key="r.schoolId" :class="T.row" data-testid="beh-school-row">
          <td :class="`${T.td} text-slate-400`">{{ i + 1 }}</td>
          <td :class="T.td">
            <RouterLink
              :to="schoolPath(r.schoolId)"
              class="font-medium text-indigo-600 hover:underline"
              data-testid="beh-school-link"
              >{{ r.name }}</RouterLink
            >
            <span class="block text-xs text-slate-400">{{ r.code ?? '-' }}</span>
          </td>
          <td :class="NUM" data-testid="cell-students">{{ count(r.students) }}</td>
          <td
            :class="[NUM, 'font-semibold', r.active > 0 ? 'text-green-600' : 'text-slate-300']"
            data-testid="cell-active"
          >
            {{ plain(r.active) }}
          </td>
          <td :class="NUM" data-testid="cell-answers">{{ count(r.answers) }}</td>
          <td :class="NUM" data-testid="cell-sessions">{{ plain(r.sessions) }}</td>
          <td :class="NUM" data-testid="cell-per-active">{{ mean(r.perActive) }}</td>
          <td :class="[NUM, 'font-bold', BAND[r.tahap].text]" data-testid="cell-score">
            {{ mean(r.score) }}
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
