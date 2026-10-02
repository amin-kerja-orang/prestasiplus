<script setup lang="ts">
/**
 * S1 "📚 GPS Mengikut Subjek" (FR-M08-18): rows by GPS ascending, rows without data ("—", 0 …) last.
 * Wide table: it scrolls inside its own card (FR-M08-123).
 */
import { computed } from 'vue'

import { DataTableCard, TABLE_CLASSES as T } from '@/components/data'

import type { SchoolPerformance } from '../../api/types'
import { ACHIEVEMENT_BAR, BAND_STYLE, DASH, bandOf, dec2 } from '../../lib/prestasi/format'

const props = defineProps<{ subjects: SchoolPerformance['subjects'] }>()

const rows = computed(() =>
  [...props.subjects].sort((a, b) => {
    if (a.gps === null && b.gps === null) return 0
    if (a.gps === null) return 1
    if (b.gps === null) return -1
    return a.gps - b.gps
  }),
)
</script>

<template>
  <section class="min-w-0 rounded-2xl bg-white p-5 shadow" data-testid="subject-card">
    <h3 class="mb-3 text-base font-bold text-slate-700">📚 GPS Mengikut Subjek</h3>
    <DataTableCard :min-width="720">
      <table :class="T.table" data-testid="subject-table">
        <thead>
          <tr>
            <th :class="T.th">#</th>
            <th :class="T.th">Subjek</th>
            <th :class="[T.th, 'text-center text-blue-400']">GPS</th>
            <th :class="[T.th, 'text-center']">Gred</th>
            <th :class="[T.th, 'text-center']">Entri</th>
            <th :class="[T.th, 'text-center text-emerald-400']">On Track</th>
            <th :class="[T.th, 'text-center text-red-400']">Below</th>
            <th :class="[T.th, 'text-center text-amber-500']">Tiada Sasaran</th>
            <th :class="T.th">Pencapaian</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(s, i) in rows"
            :key="s.subjectId"
            :class="T.row"
            :data-testid="`subject-row-${s.subjectId}`"
          >
            <td :class="[T.td, 'text-slate-400']">{{ i + 1 }}</td>
            <td :class="[T.td, 'font-semibold whitespace-nowrap text-slate-800']">{{ s.name }}</td>
            <td
              :class="[
                T.td,
                'text-center font-bold',
                s.gps === null ? 'text-slate-400' : BAND_STYLE[bandOf(s.gps)].text,
              ]"
            >
              {{ s.gps === null ? DASH : dec2(s.gps) }}
            </td>
            <td
              :class="[
                T.td,
                'text-center font-bold',
                s.gps === null ? 'text-slate-400' : BAND_STYLE[bandOf(s.gps)].text,
              ]"
            >
              {{ s.grade ?? DASH }}
            </td>
            <td :class="[T.td, 'text-center']">{{ s.entries }}</td>
            <td :class="[T.td, 'text-center text-emerald-500']">{{ s.onTrack }}</td>
            <td :class="[T.td, 'text-center text-red-500']">{{ s.below }}</td>
            <td :class="[T.td, 'text-center text-amber-500']">{{ s.noTarget }}</td>
            <td :class="[T.td, 'min-w-32']">
              <div
                v-if="s.gps !== null && s.achievementPct !== null"
                class="h-2.5 rounded-full bg-slate-100"
              >
                <div
                  :class="['h-2.5 rounded-full', ACHIEVEMENT_BAR[bandOf(s.gps)]]"
                  :style="{ width: `${s.achievementPct}%` }"
                ></div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </DataTableCard>
  </section>
</template>
