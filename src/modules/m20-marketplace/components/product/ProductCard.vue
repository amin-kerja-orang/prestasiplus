<script setup lang="ts">
/**
 * One product card (a single link to S7; FR-M20-51, FN-M20-4.1.3). `full` (S6): image, red "-{p}%"
 * badge, amber "Terpakai" badge, name (2 lines), seller + tick, price, struck original and the shipping
 * line. `simple` (S8 grid): image, name, price and struck original only
 * (FN-M20-4.3.3, FN-M20-4.2.8; no badge, no seller, no shipping line, as live).
 */
import { CircleCheck, Gift, HandCoins, MapPin, Package, Store, Truck } from '@lucide/vue'
import { computed, type Component } from 'vue'
import { RouterLink } from 'vue-router'

import type { ProductCard } from '../../api'
import { MARKETPLACE_COPY, formatPrice, shippingKindOf, type ShippingKind } from './copy'

const props = withDefaults(
  defineProps<{ product: ProductCard; variant?: 'full' | 'simple' | 'related' }>(),
  { variant: 'full' },
)

/** Live icon and colour per method: indigo-grey truck, grey-blue gift / COD, red pin. */
const SHIPPING_ICONS: Record<ShippingKind, { icon: Component; color: string }> = {
  postage: { icon: Truck, color: 'text-indigo-400' },
  free: { icon: Gift, color: 'text-slate-400' },
  cod: { icon: HandCoins, color: 'text-slate-400' },
  pickup: { icon: MapPin, color: 'text-red-500' },
}
const shipping = computed(() => SHIPPING_ICONS[shippingKindOf(props.product.shippingLine)])
</script>

<template>
  <RouterLink
    :to="`/marketplace/${product.slug}`"
    class="group flex min-w-0 flex-col overflow-hidden rounded-2xl bg-white p-4 shadow-md transition sm:p-6 hover:-translate-y-1 hover:shadow-lg"
    data-testid="product-card"
    :data-product-id="product.id"
  >
    <div class="relative aspect-square w-full overflow-hidden rounded-lg bg-slate-100">
      <img
        v-if="product.thumbnailUrl"
        :src="product.thumbnailUrl"
        :alt="product.name"
        class="h-full w-full object-cover"
        loading="lazy"
        data-testid="product-card-image"
      />
      <div
        v-else
        class="flex h-full w-full items-center justify-center text-slate-300"
        data-testid="product-card-placeholder"
      >
        <Package class="h-10 w-10" aria-hidden="true" />
      </div>
      <div
        v-if="variant === 'full'"
        class="absolute top-2 left-2 flex flex-col items-start gap-1"
        data-testid="product-card-badges"
      >
        <span
          v-if="product.discountPct !== null"
          class="rounded-lg bg-red-500 px-2 py-0.5 text-xs font-bold text-white"
          data-testid="product-card-discount"
          >-{{ product.discountPct }}%</span
        >
        <span
          v-if="product.condition === 'used'"
          class="rounded-lg bg-amber-500 px-2 py-0.5 text-xs font-bold text-white"
          data-testid="product-card-used"
          >{{ MARKETPLACE_COPY.used }}</span
        >
      </div>
    </div>
    <div class="flex min-w-0 flex-1 flex-col gap-1.5 px-3 pt-3 pb-1">
      <h4
        class="line-clamp-2 text-sm leading-snug font-semibold break-words text-slate-800"
        data-testid="product-card-name"
      >
        {{ product.name }}
      </h4>
      <p
        v-if="variant === 'full' && product.seller"
        class="flex min-w-0 items-center gap-1 text-xs text-slate-500"
        data-testid="product-card-seller"
      >
        <Store class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span class="min-w-0 truncate">{{ product.seller.shopName }}</span>
        <CircleCheck
          v-if="product.seller.verified"
          class="h-3.5 w-3.5 shrink-0 fill-blue-500 stroke-white"
          aria-hidden="true"
          data-testid="product-card-verified"
        />
      </p>
      <div class="flex flex-wrap items-baseline gap-x-2" data-testid="product-card-prices">
        <span class="text-base font-bold text-indigo-600" data-testid="product-card-price">{{
          formatPrice(product.price)
        }}</span>
        <span
          v-if="product.originalPrice !== null && variant !== 'related'"
          class="text-xs text-slate-400 line-through"
          data-testid="product-card-original"
          >{{ formatPrice(product.originalPrice) }}</span
        >
      </div>
      <p
        v-if="variant === 'full'"
        class="mt-auto flex items-start gap-1 text-xs break-words text-slate-500"
        data-testid="product-card-shipping"
      >
        <component
          :is="shipping.icon"
          class="mt-0.5 h-3.5 w-3.5 shrink-0"
          :class="shipping.color"
          aria-hidden="true"
          data-testid="product-card-shipping-icon"
        />
        <span class="min-w-0">{{ product.shippingLine }}</span>
      </p>
    </div>
  </RouterLink>
</template>
