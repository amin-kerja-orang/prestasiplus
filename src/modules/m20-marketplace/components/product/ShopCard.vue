<script setup lang="ts">
/**
 * S8 shop card (FN-M20-4.3.2, FR-M20-62): avatar initial, H1 shop name + tick, description, stars with
 * the review count, "{n} produk" (`fa-box`) and "Bergabung {relative}" (`fa-calendar`). The decorative
 * circle overflows the card edge and is clipped (`overflow-hidden`), so the page never scrolls sideways.
 */
import { Calendar, CircleCheck, Package } from '@lucide/vue'
import { computed } from 'vue'

import { diffForHumans } from '@/lib/time'

import type { ShopCard } from '../../api'
import { SHOP_COPY } from './copy'

const props = defineProps<{ shop: ShopCard }>()
const joined = computed(() => `${SHOP_COPY.joined} ${diffForHumans(props.shop.createdAt)}`)
</script>

<template>
  <section
    class="relative overflow-hidden rounded-2xl bg-linear-to-r from-indigo-500 to-purple-600 p-5 text-white shadow-lg sm:p-6"
    data-testid="shop-card"
  >
    <span
      class="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white/10"
      aria-hidden="true"
    />
    <div class="relative flex min-w-0 items-start gap-4">
      <span
        class="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-white text-2xl font-bold text-indigo-600"
        data-testid="shop-initial"
        >{{ shop.initial }}</span
      >
      <div class="min-w-0 flex-1 space-y-2">
        <h1
          class="flex min-w-0 items-center gap-2 text-xl font-bold break-words sm:text-2xl"
          data-testid="shop-name"
        >
          <span class="min-w-0 break-words">{{ shop.shopName }}</span>
          <CircleCheck
            v-if="shop.verified"
            class="h-5 w-5 shrink-0 text-blue-200"
            aria-hidden="true"
            data-testid="shop-verified"
          />
        </h1>
        <p
          v-if="shop.description"
          class="text-sm break-words text-white/90"
          data-testid="shop-description"
        >
          {{ shop.description }}
        </p>
        <p class="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/90">
          <span data-testid="shop-rating">{{ shop.ratingStars }} ({{ shop.reviewCount }})</span>
          <span class="inline-flex items-center gap-1" data-testid="shop-products">
            <Package class="h-4 w-4" aria-hidden="true" />{{ shop.productCount }}
            {{ SHOP_COPY.products }}
          </span>
          <span class="inline-flex items-center gap-1" data-testid="shop-joined">
            <Calendar class="h-4 w-4" aria-hidden="true" />{{ joined }}
          </span>
        </p>
      </div>
    </div>
  </section>
</template>
