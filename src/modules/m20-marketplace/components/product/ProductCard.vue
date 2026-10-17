<script setup lang="ts">
/**
 * One product card (a single link to S7; FR-M20-51, FN-M20-4.1.3). `full` (S6): image, discount
 * badge, "Terpakai" badge, name (2 lines), seller + tick, price, struck original and the shipping
 * line. `simple` (S8 grid): image, name, price and struck original only (FN-M20-4.3.3,
 * FN-M20-4.2.8). Product images stay images (D-RS-5).
 */
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import { DsArt3D } from '@/ds'

import type { ProductCard } from '../../api'
import { MARKETPLACE_COPY, formatPrice, shippingKindOf, type ShippingKind } from './copy'

const props = withDefaults(
  defineProps<{ product: ProductCard; variant?: 'full' | 'simple' | 'related' }>(),
  { variant: 'full' },
)

const SHIPPING_ICONS: Record<ShippingKind, string> = {
  postage: 'i-ph-truck-duotone',
  free: 'i-ph-gift-duotone',
  cod: 'i-ph-hand-coins-duotone',
  pickup: 'i-ph-map-pin-duotone',
}
const shipping = computed(() => SHIPPING_ICONS[shippingKindOf(props.product.shippingLine)])
</script>

<template>
  <UCard class="h-full" data-testid="product-card" :data-product-id="product.id">
    <RouterLink
      :to="`/marketplace/${product.slug}`"
      class="flex h-full min-w-0 flex-col gap-3"
      data-testid="product-card-link"
    >
      <div class="relative w-full overflow-hidden">
        <DsArt3D
          v-if="product.thumbnailUrl"
          variant="plain"
          :src="product.thumbnailUrl"
          :alt="product.name"
          ratio="square"
          data-testid="product-card-image"
        />
        <div
          v-else
          class="grid aspect-square w-full place-items-center bg-muted"
          data-testid="product-card-placeholder"
        >
          <UIcon name="i-ph-package-duotone" class="size-10 text-muted" aria-hidden="true" />
        </div>
        <div
          v-if="variant === 'full'"
          class="absolute top-2 left-2 flex flex-col items-start gap-1"
          data-testid="product-card-badges"
        >
          <UBadge
            v-if="product.discountPct !== null"
            color="error"
            variant="solid"
            data-testid="product-card-discount"
            >-{{ product.discountPct }}%</UBadge
          >
          <UBadge
            v-if="product.condition === 'used'"
            color="warning"
            variant="solid"
            data-testid="product-card-used"
            >{{ MARKETPLACE_COPY.used }}</UBadge
          >
        </div>
      </div>
      <div class="flex min-w-0 flex-1 flex-col gap-2">
        <h4
          class="line-clamp-2 text-label break-words text-highlighted"
          data-testid="product-card-name"
        >
          {{ product.name }}
        </h4>
        <p
          v-if="variant === 'full' && product.seller"
          class="flex min-w-0 items-center gap-1 text-caption text-muted"
          data-testid="product-card-seller"
        >
          <UIcon name="i-ph-storefront-duotone" class="size-4 shrink-0" aria-hidden="true" />
          <span class="min-w-0 truncate">{{ product.seller.shopName }}</span>
          <UIcon
            v-if="product.seller.verified"
            name="i-ph-seal-check-duotone"
            class="size-4 shrink-0 text-primary"
            aria-hidden="true"
            data-testid="product-card-verified"
          />
        </p>
        <div class="flex flex-wrap items-baseline gap-x-2" data-testid="product-card-prices">
          <span class="tabular text-subheading text-highlighted" data-testid="product-card-price">{{
            formatPrice(product.price)
          }}</span>
          <s
            v-if="product.originalPrice !== null && variant !== 'related'"
            class="text-caption text-muted"
            data-testid="product-card-original"
            >{{ formatPrice(product.originalPrice) }}</s
          >
        </div>
        <p
          v-if="variant === 'full'"
          class="mt-auto flex items-start gap-1 text-caption break-words text-muted"
          data-testid="product-card-shipping"
        >
          <UIcon
            :name="shipping"
            :data-icon="shipping"
            class="mt-1 size-4 shrink-0"
            aria-hidden="true"
            data-testid="product-card-shipping-icon"
          />
          <span class="min-w-0">{{ product.shippingLine }}</span>
        </p>
      </div>
    </RouterLink>
  </UCard>
</template>
