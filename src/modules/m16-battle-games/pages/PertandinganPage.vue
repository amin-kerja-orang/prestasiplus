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
import { DsPage, DsLoadError, DsBackLink, DsStack, DsCluster, DsHeading, DsText } from '@/ds'
import { clock } from '@/lib/time'

import { fetchWeeklyCompetition } from '../api'
import { BACK_LINK, MEDALS, PERTANDINGAN_COPY as COPY } from '../components/competition/copy'
import { formatCountdown, formatPct, formatWeekRange } from '../components/competition/format'
import { LOAD_COPY } from '../components/competition/copy'

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
    <DsStack gap="2xs" align="start">
      <DsBackLink :to="BACK_LINK.to" :label="BACK_LINK.label" data-testid="m16-back-link" />
      <header data-testid="pertandingan-hero">
        <DsHeading :level="1">{{ COPY.heading }}</DsHeading>
        <p class="mt-1 text-body text-muted">{{ COPY.sub }}</p>
      </header>
    </DsStack>

    <DsLoadError
      v-if="view.error.value"
      :message="LOAD_COPY.failed"
      testid="m16-load-error"
      retry-testid="m16-retry"
      @retry="view.reload()"
    />
    <DsStack v-else-if="!data" gap="sm" aria-busy="true" data-testid="pertandingan-loading">
      <USkeleton class="h-16 w-full" />
      <USkeleton class="h-16 w-full" />
    </DsStack>

    <template v-else>
      <UCard data-testid="pertandingan-week">
        <DsCluster justify="between">
          <div class="min-w-0">
            <DsText variant="caption">{{ COPY.weekLabel }}</DsText>
            <DsText variant="label" as="p" tone="highlighted" data-testid="pertandingan-range">{{
              weekRange
            }}</DsText>
          </div>
          <div class="text-end">
            <DsText variant="caption">{{ COPY.countdownLabel }}</DsText>
            <DsText
              variant="label"
              as="p"
              tone="primary"
              tabular
              data-testid="pertandingan-countdown"
            >
              {{ countdown }}
            </DsText>
          </div>
        </DsCluster>
      </UCard>

      <section class="grid grid-cols-3 gap-2 sm:gap-4" data-testid="pertandingan-prizes">
        <UCard
          v-for="(prize, i) in COPY.prizes"
          :key="prize.label"
          :ui="{ body: 'p-3 sm:p-3' }"
          class="text-center"
          data-testid="pertandingan-prize"
        >
          <DsText variant="title" as="div">{{ prize.medal }}</DsText>
          <p class="mt-1 text-caption text-highlighted">{{ prize.label }}</p>
          <DsText variant="label" as="p" tone="warning" tabular>+{{ data.prizes[i] }} 🪙</DsText>
        </UCard>
      </section>

      <UCard class="text-center" data-testid="pertandingan-status">
        <template v-if="data.me">
          <DsText variant="label" as="p" tone="highlighted" data-testid="pertandingan-my-rank">
            {{ COPY.myRank(data.me.rank, data.me.betul) }}
          </DsText>
        </template>
        <DsStack v-else gap="2xs" align="center">
          <DsText variant="title" as="div">📝</DsText>
          <DsText variant="label" as="p" tone="highlighted">{{ COPY.notStarted }}</DsText>
          <DsText variant="body" tone="muted">{{ COPY.notStartedHint }}</DsText>
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
        </DsStack>
      </UCard>

      <UCard :ui="{ body: 'p-3 sm:p-4' }" data-testid="pertandingan-board">
        <h2 class="mb-3 px-1 text-subheading text-highlighted">{{ COPY.boardHeading }}</h2>
        <DsStack as="ol" gap="xs">
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
              <DsText variant="label" tone="highlighted" truncate class="block">{{
                row.name
              }}</DsText>
              <DsText variant="caption" as="span" class="block"
                >{{ row.sesi }} {{ COPY.sessions }}</DsText
              >
            </span>
            <span class="shrink-0 text-end">
              <DsText variant="label" tone="success" tabular class="block">{{ row.betul }}</DsText>
              <DsText variant="caption" as="span" class="block">{{ COPY.correct }}</DsText>
            </span>
            <span class="w-16 shrink-0 text-end">
              <DsText variant="label" tone="highlighted" tabular class="block">{{
                formatPct(row.tepat)
              }}</DsText>
              <DsText variant="caption" as="span" class="block">{{ COPY.accuracy }}</DsText>
            </span>
          </li>
        </DsStack>
      </UCard>
    </template>
  </DsPage>
</template>
