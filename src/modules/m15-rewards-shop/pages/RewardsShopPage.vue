<script setup lang="ts">
/**
 * S5 `/gamification/rewards` (FR-M15-46, FR-M15-47; URS FT-M15-5.1): hero, the viewer's token
 * balance tile and the empty state. By the user's decision on OQ-M15-01 the empty state shows for
 * every account and every catalogue state: no reward card, claim control or shop endpoint exists.
 * Query parameters are ignored.
 */
import { computed } from 'vue'

import { useApi } from '@/composables'
import { DsArt3D, DsEmptyState, DsPage, DsRewardChip } from '@/ds'
import { fetchGamificationWallet } from '@/modules/m14-gamification'

import { SHOP_COPY } from '../components/copy'
import LoadError from '../components/LoadError.vue'
import LoadSkeleton from '../components/LoadSkeleton.vue'

const wallet = useApi((signal) => fetchGamificationWallet({ signal }))
const balance = computed(() => wallet.data.value?.tokenBalance ?? null)
</script>

<template>
  <DsPage data-testid="m15-shop-page">
    <UCard data-testid="shop-hero">
      <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div class="flex min-w-0 items-center gap-3">
          <DsArt3D name="party" size="xl" float />
          <div class="flex min-w-0 flex-col gap-1">
            <h1 class="text-title text-highlighted" data-testid="shop-title">
              {{ SHOP_COPY.heading }}
            </h1>
            <p class="text-body text-muted">{{ SHOP_COPY.sub }}</p>
          </div>
        </div>
        <div class="flex shrink-0 flex-col items-start gap-1" data-testid="shop-balance">
          <span class="text-caption text-muted">{{ SHOP_COPY.tileLabel }}</span>
          <DsRewardChip :value="balance ?? '…'" art="bolt" data-testid="shop-balance-value" />
        </div>
      </div>
    </UCard>

    <LoadError v-if="wallet.error.value" @retry="wallet.reload()" />
    <LoadSkeleton v-else-if="!wallet.data.value" testid="shop-loading" />
    <section v-else data-testid="shop-empty">
      <DsEmptyState
        :title="SHOP_COPY.emptyTitle"
        :description="SHOP_COPY.emptyBody"
        icon="i-ph-gift-duotone"
      />
    </section>
  </DsPage>
</template>
