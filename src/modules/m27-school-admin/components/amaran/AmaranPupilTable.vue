<script setup lang="ts">
/**
 * S4 card "Senarai Pelajar Berisiko" (FR-M27-76, BR-M18-22): sub-line "Disusun mengikut skor risiko tertinggi";
 * columns "#", "Pelajar", "Tingkatan / Kelas", "Skor", "Status", "Ketepatan", "Penglibatan", "Penguasaan". The
 * table scrolls inside its card (min width 860). Without pupils only the head shows (FR-M27-79).
 */
import { DataTableCard, TABLE_CLASSES as T } from '@/components/data'

import type { PupilRiskView } from '../../api/amaran'
import { STATUS_BADGE, STATUS_LABEL } from './amaran-format'

defineProps<{ rows: PupilRiskView[] }>()
</script>

<template>
  <section class="min-w-0" data-testid="am-pupils">
    <DataTableCard :min-width="860">
      <template #header>
        <div class="px-4 pt-4 pb-2 sm:px-5">
          <h2 class="text-base font-bold text-slate-800">Senarai Pelajar Berisiko</h2>
          <p class="text-sm text-slate-500">Disusun mengikut skor risiko tertinggi</p>
        </div>
      </template>
      <table :class="T.table" data-testid="am-table">
        <thead>
          <tr>
            <th :class="T.th">#</th>
            <th :class="T.th">Pelajar</th>
            <th :class="T.th">Tingkatan / Kelas</th>
            <th :class="T.th">Skor</th>
            <th :class="T.th">Status</th>
            <th :class="T.th">Ketepatan</th>
            <th :class="T.th">Penglibatan</th>
            <th :class="T.th">Penguasaan</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in rows" :key="p.userId" :class="T.row" data-testid="am-pupil-row">
            <td :class="T.td" data-testid="am-rank">{{ p.rank }}</td>
            <td :class="[T.td, 'font-semibold text-slate-800']" data-testid="am-name">
              {{ p.name }}
            </td>
            <td :class="T.td" data-testid="am-class">{{ p.classLabel }}</td>
            <td :class="[T.td, 'font-bold']" data-testid="am-score">{{ p.score }}</td>
            <td :class="T.td">
              <span
                :class="[
                  'inline-block rounded-full px-2 py-0.5 text-xs font-bold whitespace-nowrap',
                  STATUS_BADGE[p.status],
                ]"
                :data-status="p.status"
                data-testid="am-status"
                >{{ STATUS_LABEL[p.status] }}</span
              >
            </td>
            <td :class="T.td" data-testid="am-accuracy">{{ p.accuracyText }}</td>
            <td :class="T.td" data-testid="am-engagement">{{ p.engagementText }}</td>
            <td :class="T.td" data-testid="am-mastery">{{ p.masteryText }}</td>
          </tr>
        </tbody>
      </table>
    </DataTableCard>
  </section>
</template>
