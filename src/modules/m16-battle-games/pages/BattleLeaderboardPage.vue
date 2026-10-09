<script setup lang="ts">
/**
 * S2 `/battle/leaderboard` "Ranking Pelajar Battle" (M16-T3; SRS M16 v1.6 FR-M16-41, 42;
 * URS FN-M16-3.1). Pills "Mingguan" (default) / "Bulanan" reload the period (DV-M16-04); the
 * URL parameter `period` is ignored as on live. The seven-column table scrolls inside its card.
 */
import { computed, ref } from 'vue'

import { AlertBox, LoadingSpinner } from '@/components/feedback'
import { useApi } from '@/composables'

import { fetchStudentStandings } from '../api'
import { mskText } from '../components/battle/battle-lib'

const period = ref<'weekly' | 'monthly'>('weekly')
const { data, error, loading, reload } = useApi(
  (signal) => fetchStudentStandings(period.value, { signal }),
  period,
)
const rows = computed(() => data.value ?? [])

const PILLS = [
  { value: 'weekly', label: 'Mingguan' },
  { value: 'monthly', label: 'Bulanan' },
] as const
</script>

<template>
  <div class="mx-auto w-full max-w-4xl space-y-4" data-testid="battle-leaderboard">
    <div class="flex gap-2" data-testid="battle-leaderboard-pills">
      <button
        v-for="p in PILLS"
        :key="p.value"
        type="button"
        class="min-h-11 rounded-lg px-4 text-sm font-semibold transition"
        :class="
          period === p.value
            ? 'bg-red-500 text-white'
            : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
        "
        :data-testid="`battle-pill-${p.value}`"
        @click="period = p.value"
      >
        {{ p.label }}
      </button>
    </div>

    <div class="overflow-hidden rounded-2xl bg-white shadow-md">
      <div v-if="error" class="space-y-3 p-4" data-testid="battle-load-error">
        <AlertBox messages="Maaf, berlaku ralat. Sila cuba semula." />
        <button
          type="button"
          class="min-h-11 rounded-xl border-2 border-slate-200 px-4 text-sm font-semibold text-slate-700"
          @click="reload()"
        >
          Cuba Lagi
        </button>
      </div>
      <div v-else class="overflow-x-auto" data-testid="battle-leaderboard-scroll">
        <table class="w-full min-w-[34rem] text-sm">
          <thead>
            <tr class="bg-slate-50 text-left text-xs font-bold text-slate-600">
              <th class="px-3 py-3">#</th>
              <th class="px-3 py-3">Pelajar</th>
              <th class="px-3 py-3">Sekolah</th>
              <th class="px-3 py-3 text-center">M/S/K</th>
              <th class="px-3 py-3 text-center">Ketepatan</th>
              <th class="px-3 py-3 text-center">Streak</th>
              <th class="px-3 py-3 text-right">Skor</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading && !data">
              <td colspan="7" class="px-3 py-8 text-center text-slate-400">
                <LoadingSpinner :size="24" />
              </td>
            </tr>
            <tr v-else-if="rows.length === 0">
              <td
                colspan="7"
                class="px-3 py-8 text-center text-slate-500"
                data-testid="battle-leaderboard-empty"
              >
                Belum ada data ranking. Mula battle untuk muncul di sini!
              </td>
            </tr>
            <template v-else>
              <tr
                v-for="r in rows"
                :key="r.userId"
                class="border-t border-slate-100"
                data-testid="battle-leaderboard-row"
              >
                <td class="px-3 py-3 font-bold text-slate-700">{{ r.rank }}</td>
                <td class="px-3 py-3 font-semibold text-slate-800">{{ r.name }}</td>
                <td class="px-3 py-3 text-slate-600">{{ r.school }}</td>
                <td class="px-3 py-3 text-center" data-testid="battle-msk">
                  {{ mskText(r.menang, r.seri, r.kalah) }}
                </td>
                <td class="px-3 py-3 text-center">{{ r.ketepatan }}%</td>
                <td class="px-3 py-3 text-center">{{ r.streak }}</td>
                <td class="px-3 py-3 text-right font-bold text-slate-800">{{ r.skor }}</td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
