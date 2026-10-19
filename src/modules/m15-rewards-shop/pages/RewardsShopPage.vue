<script setup lang="ts">
/**
 * S5 `/gamification/rewards` (FR-M15-46, FR-M15-47; URS FT-M15-5.1): hero, the viewer's token
 * balance tile and the empty state. By the user's decision on OQ-M15-01 the empty state shows for
 * every account and every catalogue state: no reward card, claim control or shop endpoint exists.
 * Query parameters are ignored.
 */
import { computed } from 'vue'

import { useApi } from '@/composables'
import {
  DsArt3D,
  DsEmptyState,
  DsPage,
  DsRewardChip,
  DsLoadError,
  DsCluster,
  DsStack,
  DsHeading,
  DsText,
} from '@/ds'
import { fetchGamificationWallet } from '@/modules/m14-gamification'

import { SHOP_COPY } from '../components/copy'
import LoadSkeleton from '../components/LoadSkeleton.vue'
import { COMMON_COPY } from '../components/copy'

const wallet = useApi((signal) => fetchGamificationWallet({ signal }))
const balance = computed(() => wallet.data.value?.tokenBalance ?? null)
</script>

<template>
  <DsPage data-testid="m15-shop-page">
    <UCard data-testid="shop-hero">
      <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <DsCluster :wrap="false">
          <DsArt3D name="party" size="xl" float />
          <DsStack gap="2xs">
            <DsHeading :level="1" data-testid="shop-title">
              {{ SHOP_COPY.heading }}
            </DsHeading>
            <DsText variant="body" tone="muted">{{ SHOP_COPY.sub }}</DsText>
          </DsStack>
        </DsCluster>
        <DsStack gap="2xs" align="start" class="shrink-0" data-testid="shop-balance">
          <DsText variant="caption" as="span">{{ SHOP_COPY.tileLabel }}</DsText>
          <DsRewardChip :value="balance ?? '…'" art="bolt" data-testid="shop-balance-value" />
        </DsStack>
      </div>
    </UCard>

    <DsLoadError
      v-if="wallet.error.value"
      :message="COMMON_COPY.loadFailed"
      testid="m15-load-error"
      retry-testid="m15-retry"
      @retry="wallet.reload()"
    />
    <LoadSkeleton v-else-if="!wallet.data.value" testid="shop-loading" />
    <section v-else data-testid="shop-empty">
      <DsEmptyState :title="SHOP_COPY.emptyTitle" :description="SHOP_COPY.emptyBody" icon="gift" />
    </section>
  </DsPage>
</template>
