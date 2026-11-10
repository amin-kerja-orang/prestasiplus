<script setup lang="ts">
/**
 * `/admin/reward-control` "Kawalan Reward" (V2 `admin/reward-control.blade.php`; M14 S10), read only like V2: the
 * liability tiles, "Tetapan Kewangan", "Kos Sebenar Hadiah" and "Cabutan Bertuah". The gift table is V2's: Hadiah,
 * Kategori, Harga Token (the token price of the Hadiah catalogue, not the syiling price), Kos Sebenar and Status (`gifts`,
 * T-C12). Without `gifts` (the mock) the syiling rewards fill it with "—" for the token price. The editing endpoints
 * (`#41` to `#43`) are not on the V2 blade and not used.
 */
import type { TableColumn } from '@nuxt/ui'
import { computed } from 'vue'

import { useApi } from '@/composables'
import {
  DsBadge,
  DsDataTable,
  DsDefinitionList,
  DsEmptyState,
  DsLoadError,
  DsPage,
  DsPanel,
  DsStateView,
  DsStatRow,
  DsText,
  formatCount,
  type DefinitionItem,
  type StatItem,
} from '@/ds'

import { fetchRewardControl } from '../../api/admin'
import type { Draw, RewardGift } from '../../api/types'
import { ADMIN_COMMON, REWARD_CONTROL_COPY as COPY } from '../../lib/admin/copy'
import { formatRm } from '../../lib/admin/format'

const load = useApi((signal) => fetchRewardControl({ signal }))
const data = computed(() => load.data.value)

const stats = computed<StatItem[]>(() => {
  const t = data.value?.tiles
  return [
    {
      key: 'liability',
      label: COPY.liability(t?.sessionYear ?? new Date().getFullYear()),
      value: t ? formatRm(t.liabilityRm) : null,
      sub: COPY.liabilitySub,
      icon: 'shield-check',
      accent: 'heat',
    },
    { key: 'students', label: COPY.students, value: t?.students ?? null, icon: 'user-check', accent: 'action' },
    { key: 'claims', label: COPY.claims, value: t?.claims ?? null, icon: 'receipt', accent: 'trial' },
  ]
})

const settings = computed<DefinitionItem[] | null>(() => {
  const s = data.value?.settings
  if (!s) return null
  return [
    { key: 'budget', label: COPY.budget, value: formatRm(s.rewardBudgetSenSession / 100) },
    { key: 'flat', label: COPY.flat, value: s.flatQuizReward },
    { key: 'year', label: COPY.sessionYear, value: String(s.currentSessionYear) },
    { key: 'games', label: COPY.games, value: s.gamesAwardSyiling ? COPY.gamesYes : COPY.gamesNo },
  ]
})

/** A gift row; `tokenPrice` is null when only the syiling catalogue is known (the mock). */
type GiftRow = Omit<RewardGift, 'tokenPrice'> & { tokenPrice: number | null } & Record<string, unknown>
type DrawRow = Draw & Record<string, unknown>
const gifts = computed<GiftRow[]>(() => {
  const d = data.value
  if (!d) return []
  if (d.gifts) return d.gifts as GiftRow[]
  return d.rewards.map((r) => ({
    id: r.id,
    name: r.name,
    category: r.type,
    tokenPrice: null,
    costValueSen: r.costValueSen,
    costRm: r.costRm,
    status: 'aktif' as const,
  }))
})
const draws = computed(() => (data.value?.draws ?? []) as DrawRow[])

const GIFT_COLUMNS: TableColumn<GiftRow>[] = [
  { accessorKey: 'name', header: COPY.giftColumns.gift },
  { accessorKey: 'category', header: COPY.giftColumns.category },
  { accessorKey: 'tokenPrice', header: COPY.giftColumns.price },
  { accessorKey: 'costRm', header: COPY.giftColumns.cost },
  { accessorKey: 'status', header: COPY.giftColumns.status },
]
const DRAW_COLUMNS: TableColumn<DrawRow>[] = [
  { accessorKey: 'id', header: COPY.drawColumns.id },
  { accessorKey: 'title', header: COPY.drawColumns.title },
  { accessorKey: 'status', header: COPY.drawColumns.status },
  { accessorKey: 'ticketCostSyiling', header: COPY.drawColumns.ticket },
  { accessorKey: 'winners', header: COPY.drawColumns.winner },
]

const capital = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1)
const winners = (draw: Draw): string => {
  const names = (draw.winners ?? []).map((w) => w.name).filter(Boolean)
  return names.length > 0 ? names.join(', ') : '—'
}
</script>

<template>
  <DsPage layout="dashboard" data-testid="gam-reward-control">
    <DsLoadError
      v-if="load.error.value"
      :message="ADMIN_COMMON.loadFailed"
      testid="gam-reward-control-error"
      @retry="load.reload()"
    />
    <template v-else>
      <DsStatRow density="roomy" prefix="gam-reward-stat" :items="stats" :loading="data === null" />

      <DsStateView v-if="data === null" status="loading" skeleton="table" />
      <template v-else>
        <DsPanel :title="COPY.settingsTitle" data-testid="gam-reward-settings">
          <DsDefinitionList v-if="settings" :items="settings" :columns="2" />
          <DsEmptyState v-else size="sm" :title="COPY.settingsEmpty" />
        </DsPanel>

        <DsPanel :title="COPY.giftsTitle" padding="none" data-testid="gam-reward-gifts">
          <DsDataTable
            :data="gifts"
            :columns="GIFT_COLUMNS"
            :caption="COPY.giftColumns.gift"
            variant="bare"
            density="tight"
            pager="none"
            :page-size="Math.max(gifts.length, 1)"
            :empty-title="COPY.giftsEmpty"
          >
            <template #category-cell="{ row }">
              <DsBadge :label="row.original.category ? row.original.category.toUpperCase() : '—'" tone="neutral" size="sm" />
            </template>
            <template #tokenPrice-cell="{ row }">
              <DsText v-if="row.original.tokenPrice !== null" variant="body-strong" tone="success" tabular>
                {{ formatCount(row.original.tokenPrice) }}
              </DsText>
              <DsText v-else variant="body" tone="muted">—</DsText>
            </template>
            <template #costRm-cell="{ row }">
              <DsText variant="body-strong" :tone="row.original.costValueSen === 0 ? 'muted' : 'error'" tabular>
                {{ formatRm(row.original.costRm) }}
              </DsText>
            </template>
            <template #status-cell="{ row }">
              <DsBadge
                :label="row.original.status === 'aktif' ? COPY.giftActive : capital(row.original.status)"
                :tone="row.original.status === 'aktif' ? 'success' : 'neutral'"
                size="sm"
              />
            </template>
          </DsDataTable>
        </DsPanel>

        <DsPanel :title="COPY.drawsTitle" padding="none" data-testid="gam-reward-draws">
          <DsDataTable
            :data="draws"
            :columns="DRAW_COLUMNS"
            caption="Cabutan"
            variant="bare"
            density="tight"
            pager="none"
            :page-size="Math.max(draws.length, 1)"
            :empty-title="COPY.drawsEmpty"
          >
            <template #id-cell="{ row }">#{{ row.original.id }}</template>
            <template #status-cell="{ row }">
              <DsBadge :label="capital(String(row.original.status))" tone="neutral" size="sm" />
            </template>
            <template #ticketCostSyiling-cell="{ row }">
              <DsText variant="body-strong" tone="warning" tabular>{{ formatCount(row.original.ticketCostSyiling) }}</DsText>
            </template>
            <template #winners-cell="{ row }">{{ winners(row.original) }}</template>
          </DsDataTable>
        </DsPanel>
      </template>
    </template>
  </DsPage>
</template>
