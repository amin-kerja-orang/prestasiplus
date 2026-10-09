<script setup lang="ts">
/**
 * S7 "Penjual" card (FN-M20-4.2.6, FR-M20-59): the whole card links to S8 with the avatar initial, shop
 * name + tick, rating stars and "{n} produk". A platform product (`seller` null) shows
 * "PRESTASIPLUS Official" without a tick and without a link (PROPOSED display, OQ-M20-10).
 */
import { CircleCheck } from '@lucide/vue'
import { RouterLink } from 'vue-router'

import type { SellerCard } from '../../api'
import { DETAIL_COPY } from './copy'

defineProps<{ seller: SellerCard | null }>()
</script>

<template>
  <section class="min-w-0 rounded-2xl bg-white p-4 shadow-md sm:p-5" data-testid="seller-panel">
    <h2 class="mb-3 text-base font-bold text-slate-800">{{ DETAIL_COPY.seller }}</h2>
    <RouterLink
      v-if="seller"
      :to="`/marketplace/penjual/${seller.id}`"
      class="flex min-h-11 min-w-0 items-center gap-3 rounded-xl hover:bg-slate-50"
      data-testid="seller-link"
    >
      <span
        class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-indigo-500 text-lg font-bold text-white"
        data-testid="seller-initial"
        >{{ seller.initial }}</span
      >
      <span class="min-w-0">
        <span class="flex min-w-0 items-center gap-1.5 font-semibold text-slate-800">
          <span class="min-w-0 break-words" data-testid="seller-name">{{ seller.shopName }}</span>
          <CircleCheck
            v-if="seller.verified"
            class="h-4 w-4 shrink-0 text-blue-500"
            aria-hidden="true"
            data-testid="seller-verified"
          />
        </span>
        <span class="block text-xs text-slate-500" data-testid="seller-rating">{{
          seller.ratingStars
        }}</span>
        <span class="block text-xs text-slate-500" data-testid="seller-products">
          {{ seller.activeProductCount }} {{ DETAIL_COPY.products }}
        </span>
      </span>
    </RouterLink>
    <div v-else class="flex min-h-11 min-w-0 items-center gap-3" data-testid="seller-platform">
      <span
        class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-indigo-500 text-lg font-bold text-white"
        >P</span
      >
      <span class="min-w-0 font-semibold break-words text-slate-800">{{
        DETAIL_COPY.platformSeller
      }}</span>
    </div>
  </section>
</template>
