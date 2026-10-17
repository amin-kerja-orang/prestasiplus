<script setup lang="ts">
/**
 * S8 shop card (FN-M20-4.3.2, FR-M20-62): avatar initial, H1 shop name + tick, description, stars
 * with the review count, "{n} produk" and "Bergabung {relative}".
 */
import { computed } from 'vue'

import { diffForHumans } from '@/lib/time'

import type { ShopCard } from '../../api'
import { SHOP_COPY } from './copy'

const props = defineProps<{ shop: ShopCard }>()
const joined = computed(() => `${SHOP_COPY.joined} ${diffForHumans(props.shop.createdAt)}`)
</script>

<template>
  <UCard data-testid="shop-card">
    <div class="flex min-w-0 items-start gap-4">
      <UAvatar :text="shop.initial" size="3xl" data-testid="shop-initial" />
      <div class="flex min-w-0 flex-1 flex-col gap-2">
        <h1
          class="flex min-w-0 items-center gap-2 text-title text-highlighted"
          data-testid="shop-name"
        >
          <span class="min-w-0 break-words">{{ shop.shopName }}</span>
          <UIcon
            v-if="shop.verified"
            name="i-ph-seal-check-duotone"
            class="size-6 shrink-0 text-primary"
            aria-hidden="true"
            data-testid="shop-verified"
          />
        </h1>
        <p
          v-if="shop.description"
          class="text-body break-words text-muted"
          data-testid="shop-description"
        >
          {{ shop.description }}
        </p>
        <p class="flex flex-wrap items-center gap-x-4 gap-y-1 text-label text-default">
          <span data-testid="shop-rating">{{ shop.ratingStars }} ({{ shop.reviewCount }})</span>
          <span class="inline-flex items-center gap-1" data-testid="shop-products">
            <UIcon name="i-ph-package-duotone" class="size-4" aria-hidden="true" />{{
              shop.productCount
            }}
            {{ SHOP_COPY.products }}
          </span>
          <span class="inline-flex items-center gap-1" data-testid="shop-joined">
            <UIcon name="i-ph-calendar-blank-duotone" class="size-4" aria-hidden="true" />{{
              joined
            }}
          </span>
        </p>
      </div>
    </div>
  </UCard>
</template>
