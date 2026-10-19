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
import type { TableColumn } from '@nuxt/ui'
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { useApi } from '@/composables'
import {
  DsDataTable,
  DsIdentity,
  DsLoadError,
  DsPage,
  DsPanel,
  DsPillNav,
  DsStatRow,
  type PillItem,
  type StatItem,
  DsStack,
  DsCluster,
  DsText,
} from '@/ds'
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
import { LOAD_ERROR } from '../lib/prestasi/load'

const route = useRoute()
const period = computed(() => readPeriod(route.query.period))

const { data, error, reload } = useApi(
  (signal) => fetchLeaderboard(period.value, { signal }),
  period,
)

const firstLoad = computed(() => data.value === null && error.value === null)
const rows = computed(() => data.value?.rows ?? [])
const me = computed(() => data.value?.me ?? null)

const meTiles = computed<StatItem[]>(() => {
  const m = me.value
  if (!m) return []
  return [
    {
      key: 'rank',
      label: 'Ranking',
      icon: 'i-ph-ranking',
      accent: 'action',
      value: m.rank === null ? '#-' : `#${String(m.rank)}`,
    },
    {
      key: 'coins',
      label: 'Koin',
      icon: 'i-ph-coins',
      accent: 'win',
      value: formatNumber(m.coins),
    },
    {
      key: 'sessions',
      label: 'Sesi',
      icon: 'i-ph-books',
      accent: 'heat',
      value: formatNumber(m.sessions),
    },
    {
      key: 'accuracy',
      label: 'Ketepatan',
      icon: 'i-ph-target',
      accent: 'friend',
      value: percentText(m.accuracy),
    },
  ]
})

const TAB_ICONS: Record<string, string> = {
  all: 'i-ph-infinity',
  week: 'i-ph-calendar-dots',
  month: 'i-ph-calendar-blank',
}

const periodTabs = computed<PillItem<string>[]>(() =>
  PERIOD_TABS.map((tab) => ({
    key: tab.id,
    label: tab.label,
    icon: TAB_ICONS[tab.id],
    to: { path: LEADERBOARD_PATH, query: { period: tab.id } },
  })),
)

type Row = NonNullable<typeof data.value>['rows'][number]
const columns: TableColumn<Row>[] = [
  { accessorKey: 'rank', header: '#' },
  { accessorKey: 'name', header: 'Pelajar' },
  { accessorKey: 'coins', header: 'Koin' },
  { accessorKey: 'sessions', header: 'Sesi' },
  { accessorKey: 'accuracy', header: 'Ketepatan' },
]
</script>

<template>
  <DsPage title="Papan Pendahulu" subtitle="Siapa juara minggu ini?" data-testid="leaderboard-page">
    <DsPillNav
      :items="periodTabs"
      :active="period"
      label="Tempoh"
      testid-prefix="leaderboard-tab"
      data-testid="leaderboard-tabs"
    />

    <DsLoadError v-if="error" :message="LOAD_ERROR" testid="leaderboard-error" @retry="reload()" />

    <!-- Loading -->
    <DsStack v-else-if="firstLoad" gap="sm" aria-busy="true" data-testid="leaderboard-loading">
      <USkeleton class="h-32 w-full" />
      <USkeleton class="h-64 w-full" />
    </DsStack>

    <template v-else-if="me">
      <!-- Kedudukan Anda -->
      <DsStack as="section" gap="sm" data-testid="leaderboard-me">
        <h2 class="flex items-center gap-2 text-heading text-highlighted">
          <UIcon name="i-ph-user-circle" class="size-5 text-primary-t" aria-hidden="true" />
          Kedudukan Anda
        </h2>
        <DsStatRow :items="meTiles" prefix="me" :cols="4" />
      </DsStack>

      <!-- Podium + table -->
      <DsStack data-testid="leaderboard-board">
        <DsPanel v-if="rows.length > 0">
          <LeaderboardPodium :rows="rows" />
        </DsPanel>
        <DsDataTable
          :data="rows"
          :columns="columns"
          :page-size="Math.max(rows.length, 1)"
          variant="flush"
          layout="fixed"
          caption="Papan Pendahulu"
          data-testid="leaderboard-table"
        >
          <template #rank-cell="{ row }">
            <UBadge
              :color="row.original.rank <= 3 ? 'primary' : 'neutral'"
              :variant="row.original.rank <= 3 ? 'solid' : 'subtle'"
              :label="String(row.original.rank)"
              data-testid="row-rank"
            />
          </template>
          <template #name-cell="{ row }">
            <DsIdentity
              :name="row.original.name"
              :src="row.original.avatarUrl"
              :initials="initialOf(row.original.name)"
            >
              <template #name>
                <span class="truncate" data-testid="row-name">{{ row.original.name }}</span>
              </template>
            </DsIdentity>
          </template>
          <template #coins-cell="{ row }">
            <span
              class="inline-flex items-center gap-1 text-label whitespace-nowrap text-highlighted"
            >
              <UIcon name="i-ph-coins" class="size-4" aria-hidden="true" />
              <span data-testid="row-coins">{{ formatNumber(row.original.coins) }}</span>
            </span>
          </template>
          <template #sessions-cell="{ row }">
            <span class="text-muted" data-testid="row-sessions">{{
              formatNumber(row.original.sessions)
            }}</span>
          </template>
          <template #accuracy-cell="{ row }">
            <UBadge
              :color="accuracyColor(row.original.accuracy)"
              variant="solid"
              :label="percentText(row.original.accuracy)"
              data-testid="row-accuracy"
            />
          </template>
          <template #card="{ row }">
            <DsCluster :wrap="false">
              <UBadge
                :color="row.rank <= 3 ? 'primary' : 'neutral'"
                :variant="row.rank <= 3 ? 'solid' : 'subtle'"
                :label="String(row.rank)"
              />
              <DsIdentity :name="row.name" :src="row.avatarUrl" :initials="initialOf(row.name)" />
            </DsCluster>
            <dl class="grid grid-cols-3 gap-x-3">
              <div>
                <DsText variant="caption" as="dt">Koin</DsText>
                <DsText variant="label" as="dd" tone="highlighted" tabular>{{
                  formatNumber(row.coins)
                }}</DsText>
              </div>
              <div>
                <DsText variant="caption" as="dt">Sesi</DsText>
                <dd class="tabular text-label">{{ formatNumber(row.sessions) }}</dd>
              </div>
              <div>
                <DsText variant="caption" as="dt">Ketepatan</DsText>
                <dd>
                  <UBadge
                    :color="accuracyColor(row.accuracy)"
                    variant="solid"
                    :label="percentText(row.accuracy)"
                  />
                </dd>
              </div>
            </dl>
          </template>
        </DsDataTable>
        <div
          class="flex items-center justify-between gap-3 text-caption text-muted"
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
      </DsStack>
    </template>
  </DsPage>
</template>
