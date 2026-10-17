<script setup lang="ts">
/** Seller panel of S7: a link card to the seller's shop, or the platform seller. */
import { RouterLink } from 'vue-router'

import type { SellerCard } from '../../api'
import { DETAIL_COPY } from './copy'

defineProps<{ seller: SellerCard | null }>()
</script>

<template>
  <UCard class="min-w-0" data-testid="seller-panel">
    <div class="flex flex-col gap-3">
      <h2 class="text-overline text-muted">{{ DETAIL_COPY.seller }}</h2>
      <RouterLink
        v-if="seller"
        :to="`/marketplace/penjual/${seller.id}`"
        class="flex min-h-11 min-w-0 items-center gap-3"
        data-testid="seller-link"
      >
        <UAvatar :text="seller.initial" size="xl" data-testid="seller-initial" />
        <span class="flex min-w-0 flex-col">
          <span class="flex min-w-0 items-center gap-1 text-label text-highlighted">
            <span class="min-w-0 break-words" data-testid="seller-name">{{ seller.shopName }}</span>
            <UIcon
              v-if="seller.verified"
              name="i-ph-seal-check-duotone"
              class="size-4 shrink-0 text-primary"
              aria-hidden="true"
              data-testid="seller-verified"
            />
          </span>
          <span class="text-caption text-muted" data-testid="seller-rating">{{
            seller.ratingStars
          }}</span>
          <span class="text-caption text-muted" data-testid="seller-products">
            {{ seller.activeProductCount }} {{ DETAIL_COPY.products }}
          </span>
        </span>
      </RouterLink>
      <div v-else class="flex min-h-11 min-w-0 items-center gap-3" data-testid="seller-platform">
        <UAvatar text="P" size="xl" />
        <span class="min-w-0 text-label break-words text-highlighted">{{
          DETAIL_COPY.platformSeller
        }}</span>
      </div>
    </div>
  </UCard>
</template>
