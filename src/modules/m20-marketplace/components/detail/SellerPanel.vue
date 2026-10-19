<script setup lang="ts">
/** Seller panel of S7: a link card to the seller's shop, or the platform seller. */
import { RouterLink } from 'vue-router'

import type { SellerCard } from '../../api'
import { DETAIL_COPY } from './copy'
import { DsCluster, DsStack, DsHeading, DsText } from '@/ds'

defineProps<{ seller: SellerCard | null }>()
</script>

<template>
  <UCard class="min-w-0" data-testid="seller-panel">
    <DsStack gap="sm">
      <DsHeading :level="2" variant="overline" tone="muted">{{ DETAIL_COPY.seller }}</DsHeading>
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
              class="size-4 shrink-0 text-primary-t"
              aria-hidden="true"
              data-testid="seller-verified"
            />
          </span>
          <DsText variant="caption" as="span" data-testid="seller-rating">{{
            seller.ratingStars
          }}</DsText>
          <DsText variant="caption" as="span" data-testid="seller-products">
            {{ seller.activeProductCount }} {{ DETAIL_COPY.products }}
          </DsText>
        </span>
      </RouterLink>
      <DsCluster v-else :wrap="false" class="min-h-11" data-testid="seller-platform">
        <UAvatar text="P" size="xl" />
        <DsText variant="label" tone="highlighted" wrap="anywhere" class="min-w-0">{{
          DETAIL_COPY.platformSeller
        }}</DsText>
      </DsCluster>
    </DsStack>
  </UCard>
</template>
