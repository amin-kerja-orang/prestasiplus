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
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { useApi } from '@/composables'
import { DsIconChip, DsPage } from '@/ds'
import { formatNumber } from '@/lib/number'

import { fetchLeaderboard } from '../api/performance'
import LeaderboardPodium from '../components/LeaderboardPodium.vue'
import {
  LEADERBOARD_PATH,
  PERIOD_TABS,
  initialOf,
  percentText,
  accuracyColor,
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

const meTiles = computed(() => {
  const m = me.value
  if (!m) return []
  return [
    { id: 'rank', label: 'Ranking', icon: 'i-ph-ranking', accent: 'action' as const, value: m.rank === null ? '#-' : `#${String(m.rank)}` },
    { id: 'coins', label: 'Koin', icon: 'i-ph-coins', accent: 'win' as const, value: formatNumber(m.coins) },
    { id: 'sessions', label: 'Sesi', icon: 'i-ph-books', accent: 'action' as const, value: formatNumber(m.sessions) },
    { id: 'accuracy', label: 'Ketepatan', icon: 'i-ph-target', accent: 'win' as const, value: percentText(m.accuracy) },
  ]
})

const TAB_ICONS:Record<string, string> = {
  all: 'i-ph-infinity',
  week: 'i-ph-calendar-dots',
  month: 'i-ph-calendar-blank',
}

</script>

<template>
  <DsPage title="Papan Pendahulu" subtitle="Siapa juara minggu ini?" data-testid="leaderboard-page">

    <!-- Period links -->
    <nav class="flex flex-wrap gap-2" data-testid="leaderboard-tabs">
      <UButton
        v-for="tab in PERIOD_TABS"
        :key="tab.id"
        :to="{ path: LEADERBOARD_PATH, query: { period: tab.id } }"
        :color="period === tab.id ? 'primary' : 'neutral'"
        :variant="period === tab.id ? 'solid' : 'soft'"
        :icon="TAB_ICONS[tab.id]"
        :label="tab.label"
        size="lg"
        :data-testid="`leaderboard-tab-${tab.id}`"
        :data-active="period === tab.id ? 'true' : 'false'"
      />
    </nav>

    <!-- Error -->
    <div v-if="error" class="flex flex-col items-start gap-3" data-testid="leaderboard-error">
      <UAlert
        color="error"
        variant="subtle"
        icon="i-ph-warning-circle"
        role="alert"
        :title="LOAD_ERROR"
        class="w-full"
      />
      <UButton
        color="neutral"
        variant="soft"
        size="lg"
        label="Cuba Semula"
        data-testid="leaderboard-retry"
        @click="reload()"
      />
    </div>

    <!-- Loading -->
    <div
      v-else-if="firstLoad"
      class="flex flex-col gap-3"
      aria-busy="true"
      data-testid="leaderboard-loading"
    >
      <USkeleton class="h-32 w-full" />
      <USkeleton class="h-64 w-full" />
    </div>

    <template v-else-if="me">
      <!-- Kedudukan Anda -->
      <section class="flex flex-col gap-3" data-testid="leaderboard-me">
        <h2 class="flex items-center gap-2 text-heading text-highlighted">
          <UIcon name="i-ph-user-circle" class="size-6 text-primary" aria-hidden="true" />
          Kedudukan Anda
        </h2>
        <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
          <UCard v-for="t in meTiles" :key="t.id" class="min-w-0">
            <div class="flex flex-col items-start gap-2">
              <DsIconChip :icon="t.icon" :accent="t.accent" />
              <span class="tabular text-heading text-highlighted" :data-testid="`me-${t.id}`">{{
                t.value
              }}</span>
              <span class="-mt-1 text-caption text-muted">{{ t.label }}</span>
            </div>
          </UCard>
        </div>
      </section>

      <!-- Podium + table -->
      <UCard :ui="{ body: 'p-0 sm:p-0' }" data-testid="leaderboard-board">
        <div v-if="rows.length > 0" class="px-3 pt-8 sm:px-6">
          <LeaderboardPodium :rows="rows" />
        </div>
        <div class="overflow-x-auto">
          <div role="table" aria-label="Papan Pendahulu" data-testid="leaderboard-table">
            <div
              role="row"
              class="mt-4 grid grid-cols-12 items-center gap-2 bg-elevated px-3 py-3 text-overline text-muted sm:px-4"
            >
              <div role="columnheader" class="col-span-2 text-center sm:col-span-1">#</div>
              <div role="columnheader" class="col-span-6 md:col-span-5 lg:col-span-4">Pelajar</div>
              <div role="columnheader" class="col-span-4 text-end md:col-span-2">Koin</div>
              <div role="columnheader" class="hidden text-end md:col-span-2 md:block">Sesi</div>
              <div role="columnheader" class="hidden text-end lg:col-span-2 lg:block">
                Ketepatan
              </div>
            </div>
            <div
              v-for="row in rows"
              :key="row.rank"
              role="row"
              class="grid min-h-14 grid-cols-12 items-center gap-2 px-3 py-2 odd:bg-soft sm:px-4"
              data-testid="leaderboard-row"
            >
              <div role="cell" class="col-span-2 flex justify-center sm:col-span-1">
                <UBadge
                  :color="row.rank <= 3 ? 'primary' : 'neutral'"
                  :variant="row.rank <= 3 ? 'solid' : 'subtle'"
                  :label="String(row.rank)"
                  class="tabular"
                  data-testid="row-rank"
                />
              </div>
              <div role="cell" class="col-span-6 min-w-0 md:col-span-5 lg:col-span-4">
                <div class="flex min-w-0 items-center gap-2">
                  <UAvatar
                    :src="row.avatarUrl ?? undefined"
                    :alt="row.name"
                    :text="initialOf(row.name)"
                    size="md"
                  />
                  <span class="truncate text-label text-highlighted" data-testid="row-name">{{
                    row.name
                  }}</span>
                </div>
              </div>
              <div
                role="cell"
                class="tabular col-span-4 text-end text-label whitespace-nowrap text-highlighted md:col-span-2"
              >
                <UIcon name="i-ph-coins" class="size-4" aria-hidden="true" />
                <span data-testid="row-coins">{{ formatNumber(row.coins) }}</span>
              </div>
              <div
                role="cell"
                class="tabular hidden text-end text-body whitespace-nowrap text-muted md:col-span-2 md:block"
                data-testid="row-sessions"
              >
                {{ formatNumber(row.sessions) }}
              </div>
              <div role="cell" class="hidden text-end lg:col-span-2 lg:block">
                <UBadge
                  :color="accuracyColor(row.accuracy)"
                  variant="solid"
                  :label="percentText(row.accuracy)"
                  class="tabular"
                  data-testid="row-accuracy"
                />
              </div>
            </div>
          </div>
        </div>
        <div
          class="flex items-center justify-between gap-3 bg-elevated px-4 py-3 text-caption text-muted"
          data-testid="leaderboard-footer"
        >
          <span class="inline-flex items-center gap-2">
            <UIcon name="i-ph-users" class="size-4" aria-hidden="true" />
            <span
              ><span data-testid="participants">{{ data?.participants ?? 0 }}</span> peserta
              bersaing</span
            >
          </span>
          <span class="hidden items-center gap-2 md:inline-flex">
            <UIcon name="i-ph-arrows-clockwise" class="size-4" aria-hidden="true" />
            Dikemaskini real-time
          </span>
        </div>
      </UCard>
    </template>
  </DsPage>
</template>
