<script setup lang="ts">
/**
 * S20 `/permainan/pertandingan` (FR-M16-100..102, 138; URS FN-M16-7.3.1 ... 7.3.4; BR-M16-31): the week
 * card with its countdown (refreshed every 60 s, "Tamat!" at the end, DV-M16-17), the three prize
 * cards (3 columns at every width), the own-status card and the top 20 of the weekly ranking (M05
 * Q-WEEK-RANK through #40). `?week=` is ignored, as live.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'

import { LoadingSpinner } from '@/components/feedback'
import { useApi } from '@/composables'
import { clock } from '@/lib/time'

import { fetchWeeklyCompetition } from '../api'
import BackLink from '../components/competition/BackLink.vue'
import { MEDALS, PERTANDINGAN_COPY as COPY } from '../components/competition/copy'
import { formatCountdown, formatPct, formatWeekRange } from '../components/competition/format'
import PageLoadError from '../components/competition/PageLoadError.vue'

const REFRESH_MS = 60_000

const view = useApi((signal) => fetchWeeklyCompetition({ signal }))

/** `null` until the first tick: the countdown shows "-" (FN-M16-7.3.1). */
const nowMs = ref<number | null>(null)
let timer: ReturnType<typeof setInterval> | undefined

function tick(): void {
  nowMs.value = clock.now()
}

onMounted(() => {
  timer = setInterval(tick, REFRESH_MS)
})
onBeforeUnmount(() => {
  if (timer !== undefined) clearInterval(timer)
})

const data = computed(() => view.data.value)
const weekRange = computed(() =>
  data.value ? formatWeekRange(data.value.weekStart, data.value.weekEnd) : '',
)
const countdown = computed(() => {
  if (!data.value) return COPY.countdownBefore
  // The first tick runs as soon as the data is there.
  const now = nowMs.value ?? clock.now()
  return formatCountdown(Date.parse(data.value.endsAt), now, COPY.countdownEnded)
})

function medalOf(rank: number): string | null {
  return rank >= 1 && rank <= 3 ? (MEDALS[rank - 1] ?? null) : null
}
</script>

<template>
  <div class="mx-auto max-w-3xl min-w-0 space-y-4" data-testid="m16-pertandingan-page">
    <BackLink />

    <section
      class="rounded-2xl bg-linear-to-r from-amber-500 to-orange-500 p-4 text-white shadow-lg sm:p-6"
      data-testid="pertandingan-hero"
    >
      <h1 class="text-xl font-bold text-white sm:text-2xl">{{ COPY.heading }}</h1>
      <p class="mt-1 text-sm text-white">{{ COPY.sub }}</p>
    </section>

    <PageLoadError v-if="view.error.value" @retry="view.reload()" />
    <div
      v-else-if="!data"
      class="flex justify-center py-10 text-slate-400"
      data-testid="pertandingan-loading"
    >
      <LoadingSpinner :size="28" />
    </div>

    <template v-else>
      <section
        class="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm"
        data-testid="pertandingan-week"
      >
        <div class="min-w-0">
          <p class="text-xs text-slate-600">{{ COPY.weekLabel }}</p>
          <p class="font-bold text-slate-800" data-testid="pertandingan-range">{{ weekRange }}</p>
        </div>
        <div class="text-right">
          <p class="text-xs text-slate-600">{{ COPY.countdownLabel }}</p>
          <p class="font-bold text-red-600" data-testid="pertandingan-countdown">
            {{ countdown }}
          </p>
        </div>
      </section>

      <section class="grid grid-cols-3 gap-2 sm:gap-4" data-testid="pertandingan-prizes">
        <div
          v-for="(prize, i) in COPY.prizes"
          :key="prize.label"
          class="rounded-2xl bg-white p-3 text-center shadow-sm"
          data-testid="pertandingan-prize"
        >
          <div class="text-3xl">{{ prize.medal }}</div>
          <p class="mt-1 text-xs font-semibold text-slate-700 sm:text-sm">{{ prize.label }}</p>
          <p class="text-sm font-bold text-amber-600">+{{ data.prizes[i] }} 🪙</p>
        </div>
      </section>

      <section
        class="rounded-2xl bg-white p-4 text-center shadow-sm"
        data-testid="pertandingan-status"
      >
        <template v-if="data.me">
          <p class="font-bold text-slate-800" data-testid="pertandingan-my-rank">
            {{ COPY.myRank(data.me.rank, data.me.betul) }}
          </p>
        </template>
        <template v-else>
          <div class="text-3xl">📝</div>
          <p class="mt-1 font-bold text-slate-800">{{ COPY.notStarted }}</p>
          <p class="text-sm text-slate-600">{{ COPY.notStartedHint }}</p>
          <RouterLink
            :to="COPY.startPracticeTo"
            class="mt-3 inline-flex min-h-11 items-center justify-center rounded-xl bg-indigo-500 px-6 text-sm font-semibold text-white hover:bg-indigo-600"
            data-testid="pertandingan-start"
          >
            {{ COPY.startPractice }}
          </RouterLink>
        </template>
      </section>

      <section class="rounded-2xl bg-white p-4 shadow-sm" data-testid="pertandingan-board">
        <h2 class="mb-3 font-heading text-base font-bold text-slate-800">
          {{ COPY.boardHeading }}
        </h2>
        <ol class="divide-y divide-slate-100">
          <li
            v-for="row in data.rows"
            :key="row.userId"
            class="flex items-center gap-3 px-2 py-2"
            :class="medalOf(row.rank) ? 'rounded-lg bg-linear-to-r from-amber-50 to-white' : ''"
            data-testid="pertandingan-row"
          >
            <span class="w-8 shrink-0 text-center text-lg font-bold text-slate-600">
              {{ medalOf(row.rank) ?? row.rank }}
            </span>
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm font-semibold text-slate-800">{{
                row.name
              }}</span>
              <span class="block text-xs text-slate-600">{{ row.sesi }} {{ COPY.sessions }}</span>
            </span>
            <span class="shrink-0 text-right">
              <span class="block text-sm font-bold text-green-600">{{ row.betul }}</span>
              <span class="block text-xs text-slate-600">{{ COPY.correct }}</span>
            </span>
            <span class="w-16 shrink-0 text-right">
              <span class="block text-sm font-bold text-slate-800">{{ formatPct(row.tepat) }}</span>
              <span class="block text-xs text-slate-600">{{ COPY.accuracy }}</span>
            </span>
          </li>
        </ol>
      </section>
    </template>
  </div>
</template>
