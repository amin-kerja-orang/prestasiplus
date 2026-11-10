<script setup lang="ts">
/**
 * `/admin/gamification` "Gamifikasi Overview" (V2 `admin/gamification/overview.blade.php`; M14 S1): six KPI tiles,
 * "Taburan Tier", "Top 10 Pelajar" and "Transaksi Terkini". Read only. The overview names a tier by its key, so the
 * tier list (`#19`) supplies the icon and label.
 */
import type { TableColumn } from '@nuxt/ui'
import { computed } from 'vue'

import { useApi } from '@/composables'
import {
  DsBadge,
  DsEmptyState,
  DsDataTable,
  DsGrid,
  DsListRow,
  DsLoadError,
  DsPage,
  DsPanel,
  DsProgress,
  DsStack,
  DsStateView,
  DsStatRow,
  DsText,
  formatCount,
  type StatItem,
} from '@/ds'

import { fetchAdminOverview, fetchAdminTiers } from '../../api/admin'
import { ADMIN_COMMON, OVERVIEW_COPY as COPY } from '../../lib/admin/copy'
import { amountTone, LEDGER_TONE, relativeTime, signedAmount, tierText, tierTone, type TierTone } from '../../lib/admin/format'

const overview = useApi((signal) => fetchAdminOverview({ signal }))
const tiers = useApi((signal) => fetchAdminTiers({ signal }))

const tierList = computed(() => tiers.data.value ?? [])
const data = computed(() => overview.data.value)

function reload(): void {
  void overview.reload()
  void tiers.reload()
}

/** The tier of a distribution row: the API sends its icon and label, else the tier list supplies them. */
const distributionLabel = (row: { key: string; icon?: string; labelMs?: string }): string =>
  row.labelMs ? `${row.icon ?? ''} ${row.labelMs}`.trim() : tierText(tierList.value, row.key)

/** `DsProgress` has four tones: the tier colour's tone, with the neutral and info ones read as primary. */
const barTone = (color: string): 'primary' | 'success' | 'warning' | 'error' => {
  const tone: TierTone = tierTone(color)
  return tone === 'success' || tone === 'warning' || tone === 'error' ? tone : 'primary'
}

const stats = computed<StatItem[]>(() => {
  const c = data.value?.cards
  return [
    { key: 'students', label: COPY.cards.activeStudents, value: c?.activeStudents ?? null, icon: 'users', accent: 'action' },
    { key: 'syiling', label: COPY.cards.syilingGenerated, value: c?.syilingGenerated ?? null, icon: 'coins', accent: 'trial' },
    { key: 'tokens', label: COPY.cards.tokensConverted, value: c?.tokensConverted ?? null, icon: 'diamond', accent: 'win' },
    { key: 'conversions', label: COPY.cards.conversions, value: c?.conversions ?? null, icon: 'arrows-left-right', accent: 'friend' },
    { key: 'challenges', label: COPY.cards.activeChallenges, value: c?.activeChallenges ?? null, icon: 'target', accent: 'heat' },
    { key: 'today', label: COPY.cards.completedToday, value: c?.completedToday ?? null, icon: 'checks', accent: 'action' },
  ]
})

/** Pupils whose wallet has no tier (V2 `$noTier`). */
const noTier = computed(() => {
  const d = data.value
  if (!d) return 0
  return Math.max(0, d.cards.activeStudents - d.tierDistribution.reduce((sum, t) => sum + t.count, 0))
})

type Row = Record<string, unknown> & {
  name: string
  type: keyof typeof LEDGER_TONE
  amount: number
  source: string
  createdAt: string
}
const rows = computed(() => (data.value?.recent ?? []) as Row[])
const COLUMNS: TableColumn<Row>[] = [
  { accessorKey: 'name', header: COPY.columns.student },
  { accessorKey: 'type', header: COPY.columns.type },
  { accessorKey: 'amount', header: COPY.columns.amount },
  { accessorKey: 'source', header: COPY.columns.source },
  { accessorKey: 'createdAt', header: COPY.columns.time },
]
</script>

<template>
  <DsPage layout="dashboard" data-testid="gam-overview">
    <DsLoadError
      v-if="overview.error.value"
      :message="ADMIN_COMMON.loadFailed"
      testid="gam-overview-error"
      @retry="reload"
    />
    <template v-else>
      <DsStatRow density="roomy" prefix="gam-overview-stat" :items="stats" :loading="data === null" />

      <DsStateView v-if="data === null" status="loading" skeleton="cards" />
      <template v-else>
        <DsGrid :cols="{ base: 1, lg: 2 }" gap="md">
          <DsPanel :title="COPY.tierTitle" stretch data-testid="gam-overview-tiers">
            <DsEmptyState v-if="data.tierDistribution.length === 0" size="sm" :title="COPY.tierEmpty" />
            <DsStack v-else gap="md">
              <DsProgress
                v-for="row in data.tierDistribution"
                :key="row.key"
                :label="distributionLabel(row)"
                :value="row.widthPct"
                :tone="barTone(row.color)"
                :value-text="`${formatCount(row.count)} · ${String(row.pct)}%`"
                :data-testid="`gam-overview-tier-${row.key}`"
              />
              <DsText v-if="noTier > 0" variant="caption" tone="muted" data-testid="gam-overview-notier">
                {{ COPY.noTier(formatCount(noTier)) }}
              </DsText>
            </DsStack>
          </DsPanel>

          <DsPanel :title="COPY.topTitle" stretch data-testid="gam-overview-top">
            <DsEmptyState v-if="data.top10.length === 0" size="sm" :title="COPY.topEmpty" />
            <DsStack v-else gap="xs" as="ul">
              <DsListRow
                v-for="s in data.top10"
                :key="s.rank"
                :rank="s.rank"
                :title="s.name"
                :sub="`${s.tierLabel ? `${s.tierIcon ?? ''} ${s.tierLabel}`.trim() : tierText(tierList, s.tierKey)} · Level ${String(s.level)}`"
                :meta="`${formatCount(s.totalSyilingEarned)} ${COPY.syiling}`"
                :data-testid="`gam-overview-top-${String(s.rank)}`"
              />
            </DsStack>
          </DsPanel>
        </DsGrid>

        <DsPanel
          :title="COPY.recentTitle"
          :more-to="{ path: '/admin/gamification/transactions' }"
          :more-label="COPY.recentMore"
          padding="none"
          data-testid="gam-overview-recent"
        >
          <DsDataTable
            :data="rows"
            :columns="COLUMNS"
            :caption="COPY.recentTitle"
            variant="bare"
            density="tight"
            pager="none"
            :page-size="Math.max(rows.length, 1)"
            :empty-title="COPY.recentEmpty"
          >
            <template #type-cell="{ row }">
              <DsBadge :label="row.original.type" :tone="LEDGER_TONE[row.original.type]" size="sm" />
            </template>
            <template #amount-cell="{ row }">
              <DsText variant="body-strong" :tone="amountTone(row.original.amount)" tabular>
                {{ signedAmount(row.original.amount) }}
              </DsText>
            </template>
            <template #createdAt-cell="{ row }">{{ relativeTime(row.original.createdAt) }}</template>
          </DsDataTable>
        </DsPanel>
      </template>
    </template>
  </DsPage>
</template>
