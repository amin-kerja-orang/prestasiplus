<script setup lang="ts">
/**
 * S3 `/battle/ranking-sekolah` "Papan Ranking Sekolah" (M16-T3; SRS M16 v1.6 FR-M16-43..46,
 * BR-M16-13; URS FN-M16-3.2). Hero, period links (GET, keeping `state`), state select, the podium
 * (national rows 1-3, only when rows exist) and the "Senarai Penuh" table. An unknown `period`
 * shows all-time rows with no pill active (`activePeriod` null). The table scrolls in its card.
 */
import { Crown, ListOrdered, School } from '@lucide/vue'
import { computed } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import { AlertBox, LoadingSpinner } from '@/components/feedback'
import { useApi } from '@/composables'

import { fetchSchoolStandings } from '../api'
import { BATTLE_STATES } from '../components/battle/battle-lib'

const route = useRoute()
const router = useRouter()

const periodQuery = computed(() => {
  const p = route.query.period
  return typeof p === 'string' ? p : ''
})
const stateQuery = computed(() => {
  const s = route.query.state
  return typeof s === 'string' ? s : ''
})

const { data, error, loading, reload } = useApi(
  (signal) =>
    fetchSchoolStandings(
      {
        ...(periodQuery.value ? { period: periodQuery.value } : {}),
        ...(stateQuery.value ? { state: stateQuery.value } : {}),
      },
      { signal },
    ),
  [periodQuery, stateQuery],
)

const PERIODS = [
  { value: 'weekly', label: 'Mingguan' },
  { value: 'monthly', label: 'Bulanan' },
  { value: 'all_time', label: 'Sepanjang Masa' },
] as const

/** The period the links and the select carry: the queried one, else the default. */
const currentPeriod = computed(() => periodQuery.value || 'weekly')

function periodTo(value: string) {
  return {
    path: '/battle/ranking-sekolah',
    query: { period: value, ...(stateQuery.value ? { state: stateQuery.value } : {}) },
  }
}

function onState(event: Event): void {
  const value = (event.target as HTMLSelectElement).value
  void router.push({
    path: '/battle/ranking-sekolah',
    query: { period: currentPeriod.value, state: value },
  })
}

const rows = computed(() => data.value?.rows ?? [])
const podiumOrder = computed(() => {
  const byColumn = new Map((data.value?.podium ?? []).map((p) => [p.column, p]))
  return [2, 1, 3]
    .map((c) => byColumn.get(c as 1 | 2 | 3))
    .filter((p): p is NonNullable<typeof p> => p !== undefined)
})
</script>

<template>
  <div class="w-full space-y-4" data-testid="battle-schools">
    <!-- DV-M16-41: the title is white; live paints it dark on the blue-violet gradient -->
    <div
      class="relative flex items-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 to-violet-600 p-4 text-white shadow-lg"
    >
      <span class="absolute -top-8 -right-8 h-28 w-28 rounded-full bg-white/10" />
      <span
        class="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/20"
      >
        <School class="h-6 w-6" />
      </span>
      <div class="relative min-w-0">
        <h2 class="text-xl font-bold text-white">Papan Ranking Sekolah</h2>
        <p class="text-sm text-white/90">Sekolah mana paling hebat? Wakili sekolah anda!</p>
      </div>
    </div>

    <div class="flex flex-wrap items-center gap-2 rounded-2xl bg-white p-3 shadow-md">
      <RouterLink
        v-for="p in PERIODS"
        :key="p.value"
        :to="periodTo(p.value)"
        class="inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-semibold transition"
        :class="
          data?.activePeriod === p.value
            ? 'bg-blue-500 text-white'
            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
        "
        :data-testid="`battle-period-${p.value}`"
        >{{ p.label }}</RouterLink
      >
      <select
        :value="stateQuery"
        class="min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-300 sm:ml-auto sm:w-auto"
        data-testid="battle-state-select"
        @change="onState"
      >
        <option value="">Semua Negeri</option>
        <option v-for="s in BATTLE_STATES" :key="s" :value="s">{{ s }}</option>
      </select>
    </div>

    <div v-if="error" class="space-y-3" data-testid="battle-load-error">
      <AlertBox messages="Maaf, berlaku ralat. Sila cuba semula." />
      <button
        type="button"
        class="min-h-11 rounded-xl border-2 border-slate-200 px-4 text-sm font-semibold text-slate-700"
        @click="reload()"
      >
        Cuba Lagi
      </button>
    </div>
    <div v-else-if="loading && !data" class="flex justify-center py-10 text-slate-400">
      <LoadingSpinner :size="28" />
    </div>
    <template v-else>
      <!-- Podium: 2nd, 1st (raised, crown), 3rd -->
      <div
        v-if="podiumOrder.length > 0"
        class="grid grid-cols-3 items-end gap-2 pt-5 sm:gap-4"
        data-testid="battle-podium"
      >
        <div
          v-for="p in podiumOrder"
          :key="p.column"
          class="relative min-w-0 rounded-2xl border-t-4 bg-white px-2 pb-4 text-center shadow-md sm:px-4"
          :class="
            p.column === 1
              ? 'border-amber-400 bg-amber-50 pt-8 pb-6'
              : p.column === 2
                ? 'border-slate-400 pt-7'
                : 'border-orange-500 pt-7'
          "
          :data-testid="`battle-podium-${p.column}`"
        >
          <span
            class="absolute -top-5 left-1/2 flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full text-sm font-bold text-white"
            :class="
              p.column === 1 ? 'bg-amber-400' : p.column === 2 ? 'bg-slate-400' : 'bg-orange-500'
            "
          >
            <Crown v-if="p.column === 1" class="h-5 w-5" />
            <template v-else>{{ p.column }}</template>
          </span>
          <School
            class="mx-auto h-6 w-6"
            :class="
              p.column === 1
                ? 'text-amber-500'
                : p.column === 2
                  ? 'text-slate-400'
                  : 'text-orange-500'
            "
          />
          <p class="mt-1 text-xs font-bold break-words text-slate-800 sm:text-sm">{{ p.name }}</p>
          <p class="text-xs text-slate-500">{{ p.state }}</p>
          <p
            class="mt-1 text-xl font-bold sm:text-2xl"
            :class="p.column === 1 ? 'text-orange-500' : 'text-slate-700'"
          >
            {{ p.skor }}
          </p>
          <p class="text-xs text-slate-400">mata</p>
        </div>
      </div>

      <div class="overflow-hidden rounded-2xl bg-white shadow-md">
        <h3 class="flex items-center gap-2 px-4 pt-4 text-base font-bold text-slate-800">
          <ListOrdered class="h-5 w-5 text-blue-500" /> Senarai Penuh
        </h3>
        <div class="mt-3 overflow-x-auto" data-testid="battle-schools-scroll">
          <table class="w-full min-w-[34rem] text-sm">
            <thead>
              <tr class="bg-slate-50 text-left text-xs font-bold text-slate-600">
                <th class="px-3 py-3">#</th>
                <th class="px-3 py-3">Sekolah</th>
                <th class="px-3 py-3 text-center">Battle</th>
                <th class="px-3 py-3 text-center">M/S/K</th>
                <th class="px-3 py-3 text-center">Ketepatan</th>
                <th class="px-3 py-3 text-center">Pelajar</th>
                <th class="px-3 py-3 text-right">Skor</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="rows.length === 0">
                <td
                  colspan="7"
                  class="px-3 py-8 text-center text-slate-500"
                  data-testid="battle-schools-empty"
                >
                  Belum ada data ranking. Mula battle untuk melihat ranking sekolah!
                </td>
              </tr>
              <template v-else>
                <tr
                  v-for="r in rows"
                  :key="r.schoolId"
                  class="border-t border-slate-100"
                  data-testid="battle-school-row"
                >
                  <td
                    class="px-3 py-3 font-bold"
                    :class="r.rank <= 3 ? 'text-orange-500' : 'text-slate-600'"
                  >
                    {{ r.rank }}
                  </td>
                  <td class="px-3 py-3">
                    <RouterLink
                      :to="`/battle/ranking-sekolah/${r.schoolId}`"
                      class="block font-semibold text-slate-800 hover:underline"
                      data-testid="battle-school-link"
                      >{{ r.name }}</RouterLink
                    >
                    <span class="block text-xs text-slate-500">{{ r.state }} · {{ r.type }}</span>
                  </td>
                  <td class="px-3 py-3 text-center font-semibold text-slate-800">
                    {{ r.battles }}
                  </td>
                  <td class="px-3 py-3 text-center" data-testid="battle-msk">
                    <span class="text-green-600">{{ r.menang }}</span
                    >/<span class="text-slate-500">{{ r.seri }}</span
                    >/<span class="text-red-500">{{ r.kalah }}</span>
                  </td>
                  <td class="px-3 py-3 text-center text-slate-600">{{ r.ketepatan }}%</td>
                  <td class="px-3 py-3 text-center text-slate-600">{{ r.pelajar }}</td>
                  <td class="px-3 py-3 text-right font-bold text-blue-600">{{ r.skor }}</td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>
