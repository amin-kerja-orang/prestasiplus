<script setup lang="ts">
/**
 * S5 `/gamification/rewards` (FR-M15-46, FR-M15-47; URS FT-M15-5.1): hero, the viewer's token
 * balance tile and the gift cards of the shared catalogue (FD-MUR-33, R-02, V2 parity: active gifts by
 * token cost; a sold-out gift stays listed as "Habis stok"); the empty state shows when there is no gift.
 * No claim control yet. Query parameters are ignored.
 */
import { computed } from 'vue'

import { useApi } from '@/composables'
import { DsArt3D, DsEmptyState, DsPage, DsRewardChip, DsLoadError } from '@/ds'
import { fetchGamificationWallet } from '@/modules/m14-gamification'

import { fetchDigitalItems } from '../api'
import { SHOP_COPY } from '../components/copy'
import LoadSkeleton from '../components/LoadSkeleton.vue'
import { COMMON_COPY } from '../components/copy'

const wallet = useApi((signal) => fetchGamificationWallet({ signal }))
const items = useApi((signal) => fetchDigitalItems({ signal }))
const gifts = computed(() => items.data.value?.data ?? [])
const failed = computed(() => wallet.error.value !== null || items.error.value !== null)
const ready = computed(() => wallet.data.value !== null && items.data.value !== null)
const fixed2 = (n: number): string => n.toFixed(2)

function retry(): void {
  void wallet.reload()
  void items.reload()
}
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

    <DsLoadError v-if="failed" :message="COMMON_COPY.loadFailed" testid="m15-load-error" retry-testid="m15-retry" @retry="retry()" />
    <LoadSkeleton v-else-if="!ready" testid="shop-loading" />
    <ul v-else-if="gifts.length > 0" class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="shop-grid">
      <li v-for="g in gifts" :key="g.id" data-testid="shop-card">
        <UCard class="h-full">
          <div class="flex min-w-0 flex-col gap-2">
            <span class="text-caption text-muted">{{ g.category.toUpperCase() }}</span>
            <h2 class="text-body text-highlighted break-words" data-testid="shop-card-title">{{ g.iconEmoji ? `${g.iconEmoji} ` : '' }}{{ g.title }}</h2>
            <p v-if="g.vendor" class="text-caption text-muted">{{ g.vendor }}</p>
            <DsRewardChip :value="g.tokenCost" art="bolt" data-testid="shop-card-cost" />
            <p v-if="g.denominationRm > 0" class="text-caption text-muted">{{ SHOP_COPY.faceValue(fixed2(g.denominationRm)) }}</p>
            <p class="text-caption" :class="g.inStock ? 'text-muted' : 'text-error'" data-testid="shop-card-stock">
              {{ g.inStock ? (g.stockQuantity === null ? '' : SHOP_COPY.stock(g.stockQuantity)) : SHOP_COPY.soldOut }}
            </p>
          </div>
        </UCard>
      </li>
    </ul>
    <section v-else data-testid="shop-empty">
      <DsEmptyState
        :title="SHOP_COPY.emptyTitle"
        :description="SHOP_COPY.emptyBody"
        icon="gift"
      />
    </section>
  </DsPage>
</template>
