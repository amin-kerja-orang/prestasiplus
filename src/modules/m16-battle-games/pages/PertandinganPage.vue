<script setup lang="ts">
/**
 * S20 `/permainan/pertandingan` (FR-M16-100..102, 138; URS FN-M16-7.3.1 ... 7.3.4; BR-M16-31): the week
 * card with its countdown (refreshed every 60 s, "Tamat!" at the end, DV-M16-17), the three prize
 * cards (3 columns at every width), the own-status card and the top 20 of the weekly ranking (M05
 * Q-WEEK-RANK through #40). `?week=` is ignored, as live.
 *
 * v2 learner look: back link and plain heading (no hero), raised cards for the week, the prizes (medal
 * emoji) and the board; the start button is the A1 CTA; ranks from 4 are muted.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import { useApi } from '@/composables'
import { DsPage } from '@/ds'
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
  <DsPage data-testid="m16-pertandingan-page">
    <div class="flex flex-col items-start gap-1">
      <BackLink />
      <header data-testid="pertandingan-hero">
        <h1 class="text-title text-highlighted">{{ COPY.heading }}</h1>
        <p class="mt-1 text-body text-muted">{{ COPY.sub }}</p>
      </header>
    </div>

    <PageLoadError v-if="view.error.value" @retry="view.reload()" />
    <div
      v-else-if="!data"
      class="flex flex-col gap-3"
      aria-busy="true"
      data-testid="pertandingan-loading"
    >
      <USkeleton class="h-16 w-full" />
      <USkeleton class="h-16 w-full" />
    </div>

    <template v-else>
      <UCard data-testid="pertandingan-week">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="text-caption text-muted">{{ COPY.weekLabel }}</p>
            <p class="text-label text-highlighted" data-testid="pertandingan-range">{{ weekRange }}</p>
          </div>
          <div class="text-end">
            <p class="text-caption text-muted">{{ COPY.countdownLabel }}</p>
            <p class="tabular text-label text-primary" data-testid="pertandingan-countdown">
              {{ countdown }}
            </p>
          </div>
        </div>
      </UCard>

      <section class="grid grid-cols-3 gap-2 sm:gap-4" data-testid="pertandingan-prizes">
        <UCard
          v-for="(prize, i) in COPY.prizes"
          :key="prize.label"
          :ui="{ body: 'p-3 sm:p-3' }"
          class="text-center"
          data-testid="pertandingan-prize"
        >
          <div class="text-title">{{ prize.medal }}</div>
          <p class="mt-1 text-caption text-highlighted">{{ prize.label }}</p>
          <p class="tabular text-label text-warning">+{{ data.prizes[i] }} 🪙</p>
        </UCard>
      </section>

      <UCard class="text-center" data-testid="pertandingan-status">
        <template v-if="data.me">
          <p class="text-label text-highlighted" data-testid="pertandingan-my-rank">
            {{ COPY.myRank(data.me.rank, data.me.betul) }}
          </p>
        </template>
        <div v-else class="flex flex-col items-center gap-1">
          <div class="text-title">📝</div>
          <p class="text-label text-highlighted">{{ COPY.notStarted }}</p>
          <p class="text-body text-muted">{{ COPY.notStartedHint }}</p>
          <UButton
            :to="COPY.startPracticeTo"
            size="xl"
            color="primary"
            variant="solid"
            class="mt-3 min-h-12"
            data-testid="pertandingan-start"
          >
            {{ COPY.startPractice }}
          </UButton>
        </div>
      </UCard>

      <UCard :ui="{ body: 'p-3 sm:p-4' }" data-testid="pertandingan-board">
        <h2 class="mb-3 px-1 text-subheading text-highlighted">{{ COPY.boardHeading }}</h2>
        <ol class="flex flex-col gap-2">
          <li
            v-for="row in data.rows"
            :key="row.userId"
            class="flex items-center gap-3 bg-elevated p-3"
            data-testid="pertandingan-row"
          >
            <span
              class="w-8 shrink-0 text-center text-label"
              :class="medalOf(row.rank) ? 'text-highlighted' : 'text-muted'"
            >
              {{ medalOf(row.rank) ?? row.rank }}
            </span>
            <span class="min-w-0 flex-1">
              <span class="block truncate text-label text-highlighted">{{ row.name }}</span>
              <span class="block text-caption text-muted">{{ row.sesi }} {{ COPY.sessions }}</span>
            </span>
            <span class="shrink-0 text-end">
              <span class="tabular block text-label text-success">{{ row.betul }}</span>
              <span class="block text-caption text-muted">{{ COPY.correct }}</span>
            </span>
            <span class="w-16 shrink-0 text-end">
              <span class="tabular block text-label text-highlighted">{{ formatPct(row.tepat) }}</span>
              <span class="block text-caption text-muted">{{ COPY.accuracy }}</span>
            </span>
          </li>
        </ol>
      </UCard>
    </template>
  </DsPage>
</template>
