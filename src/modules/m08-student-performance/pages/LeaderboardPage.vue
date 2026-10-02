<script setup lang="ts">
/**
 * S20 `/leaderboard` "Papan Pendahulu" (M08-T4; FR-M08-113..118, BR-M08-28; FN-M08-7.2.*).
 *
 * - Hero (the subtitle "Siapa juara minggu ini?" stays for every period) and the period links
 *   "Semua Masa" / "Minggu Ini" / "Bulan Ini"; no or unknown `period` is the week.
 * - "Kedudukan Anda": the viewer's rank, coins, sessions and accuracy ("#-", 0, 0, 0% when unranked).
 * - Podium (top 3, order 2-1-3) and a table of at most 50 rows: # / Pelajar / Koin, Sesi from 768px,
 *   Ketepatan from 1024px. Every viewer sees the same list; names are plain text (no user link).
 * - Footer "{n} peserta bersaing" and, from 768px, "Dikemaskini real-time".
 */
import {
  CalendarDays,
  CalendarRange,
  CircleUserRound,
  Coins,
  Infinity as InfinityIcon,
  RefreshCw,
  Users,
} from '@lucide/vue'
import { computed, type Component } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

import { AlertBox } from '@/components/feedback'
import { useApi } from '@/composables'
import { formatNumber } from '@/lib/number'

import { fetchLeaderboard } from '../api/performance'
import LeaderboardPodium from '../components/LeaderboardPodium.vue'
import {
  LEADERBOARD_PATH,
  PERIOD_TABS,
  initialOf,
  percentText,
  pillClass,
  rankCircleClass,
  readPeriod,
} from '../lib/leaderboard'

const LOAD_ERROR = 'Maaf, berlaku ralat. Sila cuba semula.'

const route = useRoute()
const period = computed(() => readPeriod(route.query.period))

const { data, error, reload } = useApi(
  (signal) => fetchLeaderboard(period.value, { signal }),
  period,
)

const firstLoad = computed(() => data.value === null && error.value === null)
const rows = computed(() => data.value?.rows ?? [])
const me = computed(() => data.value?.me ?? null)

const TAB_ICONS: Record<string, Component> = {
  all: InfinityIcon,
  week: CalendarRange,
  month: CalendarDays,
}

const TAB_BASE =
  'inline-flex min-h-11 items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-bold transition'
</script>

<template>
  <div class="space-y-4 sm:space-y-5" data-testid="leaderboard-page">
    <!-- Hero -->
    <section
      class="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-500 to-violet-500 px-4 py-8 text-center text-white shadow-lg"
      data-testid="leaderboard-hero"
    >
      <div
        class="pointer-events-none absolute top-6 -left-4 text-7xl opacity-20"
        aria-hidden="true"
      >
        ⭐
      </div>
      <div
        class="pointer-events-none absolute -top-2 -right-2 text-7xl opacity-20"
        aria-hidden="true"
      >
        🏅
      </div>
      <div class="relative">
        <div class="text-5xl" aria-hidden="true">🏆</div>
        <h2 class="mt-2 font-heading text-2xl font-bold sm:text-3xl">Papan Pendahulu</h2>
        <p class="mt-1 text-sm text-white/80">Siapa juara minggu ini?</p>
      </div>
    </section>

    <!-- Period links -->
    <nav class="flex flex-wrap justify-center gap-2 sm:gap-3" data-testid="leaderboard-tabs">
      <RouterLink
        v-for="tab in PERIOD_TABS"
        :key="tab.id"
        :to="{ path: LEADERBOARD_PATH, query: { period: tab.id } }"
        :class="[
          TAB_BASE,
          period === tab.id
            ? 'bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-lg'
            : 'bg-white text-slate-600 shadow hover:bg-slate-50',
        ]"
        :data-testid="`leaderboard-tab-${tab.id}`"
        :data-active="period === tab.id ? 'true' : 'false'"
      >
        <component :is="TAB_ICONS[tab.id]" class="h-4 w-4" aria-hidden="true" />
        {{ tab.label }}
      </RouterLink>
    </nav>

    <!-- Error -->
    <div v-if="error" class="space-y-3" data-testid="leaderboard-error">
      <AlertBox :messages="LOAD_ERROR" />
      <button
        type="button"
        class="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow transition hover:bg-blue-700"
        data-testid="leaderboard-retry"
        @click="reload()"
      >
        Cuba Semula
      </button>
    </div>

    <!-- Loading -->
    <div v-else-if="firstLoad" class="space-y-3" data-testid="leaderboard-loading">
      <div class="h-32 animate-pulse rounded-2xl bg-white/70"></div>
      <div class="h-64 animate-pulse rounded-2xl bg-white/70"></div>
    </div>

    <template v-else-if="me">
      <!-- Kedudukan Anda -->
      <section
        class="rounded-2xl border-2 border-indigo-400 bg-gradient-to-br from-indigo-100 to-violet-100 p-4 sm:p-5"
        data-testid="leaderboard-me"
      >
        <h3 class="flex items-center gap-2 font-heading text-base font-bold text-slate-800">
          <CircleUserRound class="h-6 w-6 text-indigo-500" aria-hidden="true" />
          Kedudukan Anda
        </h3>
        <div class="mt-3 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
          <div class="rounded-xl bg-white p-3 text-center sm:p-4">
            <div class="font-heading text-2xl font-bold text-indigo-600" data-testid="me-rank">
              {{ me.rank === null ? '#-' : `#${String(me.rank)}` }}
            </div>
            <div class="text-xs text-slate-500">Ranking</div>
          </div>
          <div class="rounded-xl bg-white p-3 text-center sm:p-4">
            <div class="font-heading text-2xl font-bold text-amber-600" data-testid="me-coins">
              {{ formatNumber(me.coins) }}
            </div>
            <div class="text-xs text-slate-500">Koin</div>
          </div>
          <div class="rounded-xl bg-white p-3 text-center sm:p-4">
            <div class="font-heading text-2xl font-bold text-blue-600" data-testid="me-sessions">
              {{ formatNumber(me.sessions) }}
            </div>
            <div class="text-xs text-slate-500">Sesi</div>
          </div>
          <div class="rounded-xl bg-white p-3 text-center sm:p-4">
            <div class="font-heading text-2xl font-bold text-green-600" data-testid="me-accuracy">
              {{ percentText(me.accuracy) }}
            </div>
            <div class="text-xs text-slate-500">Ketepatan</div>
          </div>
        </div>
      </section>

      <!-- Podium + table -->
      <section class="overflow-hidden rounded-2xl bg-white shadow" data-testid="leaderboard-board">
        <div v-if="rows.length > 0" class="px-3 pt-8 pb-0 sm:px-6">
          <LeaderboardPodium :rows="rows" />
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-sm" data-testid="leaderboard-table">
            <thead>
              <tr
                class="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold text-slate-500"
              >
                <th scope="col" class="w-12 px-3 py-3 text-center sm:px-4">#</th>
                <th scope="col" class="px-3 py-3">Pelajar</th>
                <th scope="col" class="px-3 py-3 text-right">Koin</th>
                <th scope="col" class="hidden px-3 py-3 text-right md:table-cell">Sesi</th>
                <th scope="col" class="hidden px-3 py-3 text-right lg:table-cell">Ketepatan</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in rows"
                :key="row.rank"
                class="border-b border-slate-100 last:border-b-0"
                data-testid="leaderboard-row"
              >
                <td class="px-3 py-2.5 text-center sm:px-4">
                  <span
                    :class="[
                      'inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold',
                      rankCircleClass(row.rank),
                    ]"
                    data-testid="row-rank"
                    >{{ row.rank }}</span
                  >
                </td>
                <td class="max-w-0 px-3 py-2.5">
                  <div class="flex min-w-0 items-center gap-2">
                    <div
                      :class="[
                        'flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 bg-white text-sm font-bold text-indigo-600',
                        row.rank <= 3 ? 'border-amber-300' : 'border-slate-200',
                      ]"
                    >
                      <img
                        v-if="row.avatarUrl"
                        :src="row.avatarUrl"
                        :alt="row.name"
                        class="h-full w-full object-cover"
                      />
                      <span v-else>{{ initialOf(row.name) }}</span>
                    </div>
                    <span class="truncate font-semibold text-slate-800" data-testid="row-name">{{
                      row.name
                    }}</span>
                  </div>
                </td>
                <td class="px-3 py-2.5 text-right font-bold whitespace-nowrap text-amber-600">
                  <Coins class="mr-1 inline h-4 w-4" aria-hidden="true" />
                  <span data-testid="row-coins">{{ formatNumber(row.coins) }}</span>
                </td>
                <td
                  class="hidden px-3 py-2.5 text-right whitespace-nowrap text-slate-600 md:table-cell"
                  data-testid="row-sessions"
                >
                  {{ formatNumber(row.sessions) }}
                </td>
                <td class="hidden px-3 py-2.5 text-right lg:table-cell">
                  <span
                    :class="[
                      'inline-block rounded-full px-2.5 py-0.5 text-xs font-bold',
                      pillClass(row.accuracy),
                    ]"
                    data-testid="row-accuracy"
                    >{{ percentText(row.accuracy) }}</span
                  >
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div
          class="flex items-center justify-between gap-3 bg-slate-50 px-4 py-3 text-xs text-slate-500"
          data-testid="leaderboard-footer"
        >
          <span class="inline-flex items-center gap-1.5">
            <Users class="h-4 w-4" aria-hidden="true" />
            <span
              ><span data-testid="participants">{{ data?.participants ?? 0 }}</span> peserta
              bersaing</span
            >
          </span>
          <span class="hidden items-center gap-1.5 md:inline-flex">
            <RefreshCw class="h-4 w-4" aria-hidden="true" />
            Dikemaskini real-time
          </span>
        </div>
      </section>
    </template>
  </div>
</template>
