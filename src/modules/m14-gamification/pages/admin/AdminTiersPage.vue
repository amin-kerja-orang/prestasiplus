<script setup lang="ts">
/**
 * `/admin/gamification/tiers` "Tier Configuration" (V2 `admin/gamification/tiers.blade.php`; M14 S2), read only
 * (decision D118-3: V2 shows the reward matrix and has no editor). One panel per tier: order and pupil count, Min
 * Syiling, Kadar Tukar, colour, the three reward blocks (Latih Tubi L1 to L5, PKSK, Papan Bijak) and the perks.
 * The pupil count per tier comes from the overview (`#18`).
 */
import { computed } from 'vue'

import { useApi } from '@/composables'
import {
  DsCallout,
  DsDefinitionList,
  DsEmptyState,
  DsGrid,
  DsLoadError,
  DsPage,
  DsPanel,
  DsStack,
  DsStateView,
  DsSurface,
  DsText,
  formatCount,
  type DefinitionItem,
} from '@/ds'

import { fetchAdminOverview, fetchAdminTiers } from '../../api/admin'
import type { Tier } from '../../api/types'
import { ADMIN_COMMON, TIERS_COPY as COPY } from '../../lib/admin/copy'

const tiers = useApi((signal) => fetchAdminTiers({ signal }))
const overview = useApi((signal) => fetchAdminOverview({ signal }))

const list = computed(() => tiers.data.value)
const loadError = computed(() => tiers.error.value)

function reload(): void {
  void tiers.reload()
  void overview.reload()
}

function population(tier: Tier): string {
  const found = overview.data.value?.tierDistribution.find((d) => d.key === tier.tierName)
  return formatCount(found?.count ?? 0)
}

function facts(tier: Tier): DefinitionItem[] {
  return [
    { key: 'min', label: COPY.minSyiling, value: tier.minSyiling },
    { key: 'rate', label: COPY.rate, value: String(tier.conversionRate) },
    { key: 'color', label: 'Warna', value: tier.color || '—', mono: true },
  ]
}

function quizLevels(tier: Tier): DefinitionItem[] {
  return [
    { key: 'l1', label: 'L1', value: tier.quizRewardL1 },
    { key: 'l2', label: 'L2', value: tier.quizRewardL2 },
    { key: 'l3', label: 'L3', value: tier.quizRewardL3 },
    { key: 'l4', label: 'L4', value: tier.quizRewardL4 },
    { key: 'l5', label: 'L5', value: tier.quizRewardL5 },
  ]
}
</script>

<template>
  <DsPage layout="list" data-testid="gam-tiers">
    <DsLoadError v-if="loadError" :message="ADMIN_COMMON.loadFailed" testid="gam-tiers-error" @retry="reload" />
    <DsStateView v-else-if="list === null" status="loading" skeleton="cards" />
    <template v-else>
      <DsCallout tone="info" :description="COPY.note" data-testid="gam-tiers-note" />

      <DsEmptyState v-if="list.length === 0" icon="crown" :title="COPY.empty" data-testid="gam-tiers-empty" />
      <DsStack v-else gap="md">
        <DsPanel
          v-for="tier in list"
          :key="tier.id"
          :title="`${tier.icon} ${tier.labelMs}`"
          :description="COPY.order(tier.sortOrder, population(tier))"
          :data-testid="`gam-tier-${tier.tierName}`"
        >
          <DsStack gap="md">
            <DsDefinitionList :items="facts(tier)" :columns="2" />

            <DsGrid :cols="{ base: 1, md: 3 }" gap="md">
              <DsSurface level="soft" :data-testid="`gam-tier-${tier.tierName}-quiz`">
                <DsStack gap="sm">
                  <DsText variant="body-strong">{{ COPY.quizTitle }}</DsText>
                  <DsDefinitionList :items="quizLevels(tier)" :columns="2" />
                </DsStack>
              </DsSurface>
              <DsSurface level="soft" :data-testid="`gam-tier-${tier.tierName}-pksk`">
                <DsStack gap="sm">
                  <DsText variant="body-strong">{{ COPY.pkskTitle }}</DsText>
                  <DsText variant="kpi" tone="primary" tabular>{{ tier.pkskRewardCorrect }}</DsText>
                  <DsText variant="caption" tone="muted">{{ COPY.pkskNote }}</DsText>
                </DsStack>
              </DsSurface>
              <DsSurface level="soft" :data-testid="`gam-tier-${tier.tierName}-board`">
                <DsStack gap="sm">
                  <DsText variant="body-strong">{{ COPY.boardTitle }}</DsText>
                  <DsText variant="kpi" tone="success" tabular>{{ tier.boardGameRewardWin }}</DsText>
                  <DsText variant="caption" tone="muted">{{ COPY.boardNote }}</DsText>
                </DsStack>
              </DsSurface>
            </DsGrid>

            <DsText v-if="tier.perks.length > 0" variant="body" tone="toned" :data-testid="`gam-tier-${tier.tierName}-perks`">
              ⭐ {{ tier.perks.join(' · ') }}
            </DsText>
          </DsStack>
        </DsPanel>
      </DsStack>
    </template>
  </DsPage>
</template>
