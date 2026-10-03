<script setup lang="ts">
/**
 * S5 `/gamification/rewards` (FR-M15-46, FR-M15-47; URS FT-M15-5.1): hero, the viewer's token
 * balance tile and the empty state. By the user's decision on OQ-M15-01 the empty state shows for
 * every account and every catalogue state: no reward card, claim control or shop endpoint exists.
 * Query parameters are ignored.
 */
import { computed } from 'vue'

import { LoadingSpinner } from '@/components/feedback'
import { useApi } from '@/composables'
import { fetchGamificationWallet } from '@/modules/m14-gamification'

import { SHOP_COPY } from '../components/copy'
import LoadError from '../components/LoadError.vue'

const wallet = useApi((signal) => fetchGamificationWallet({ signal }))
const balance = computed(() => wallet.data.value?.tokenBalance ?? null)
</script>

<template>
  <div class="min-w-0 space-y-6" data-testid="m15-shop-page">
    <section
      class="flex flex-col gap-4 rounded-[20px] bg-linear-to-r from-emerald-600 via-emerald-500 to-emerald-400 p-4 text-white shadow sm:p-6 md:flex-row md:items-center md:justify-between"
      data-testid="shop-hero"
    >
      <div class="min-w-0">
        <h1 class="text-sm font-bold text-white sm:text-2xl" data-testid="shop-title">
          {{ SHOP_COPY.heading }}
        </h1>
        <p class="mt-1 text-sm text-white">{{ SHOP_COPY.sub }}</p>
      </div>
      <div
        class="flex shrink-0 flex-col items-center self-start rounded-xl bg-white/15 px-4 py-2 text-center md:self-auto"
        data-testid="shop-balance"
      >
        <span class="text-xl font-bold text-white" data-testid="shop-balance-value">{{
          balance ?? '…'
        }}</span>
        <span class="text-xs text-white">{{ SHOP_COPY.tileLabel }}</span>
      </div>
    </section>

    <LoadError v-if="wallet.error.value" @retry="wallet.reload()" />
    <div
      v-else-if="!wallet.data.value"
      class="flex justify-center py-10 text-slate-400"
      data-testid="shop-loading"
    >
      <LoadingSpinner :size="28" />
    </div>
    <section v-else class="px-4 py-12 text-center" data-testid="shop-empty">
      <div class="text-3xl sm:text-6xl">{{ SHOP_COPY.emptyIcon }}</div>
      <h2 class="mt-3 font-heading text-lg font-bold text-slate-800">{{ SHOP_COPY.emptyTitle }}</h2>
      <p class="mt-1 text-sm text-slate-400">{{ SHOP_COPY.emptyBody }}</p>
    </section>
  </div>
</template>
