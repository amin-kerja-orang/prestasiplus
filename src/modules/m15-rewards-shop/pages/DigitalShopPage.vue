<script setup lang="ts">
/**
 * S10 `/cikgu/hadiah` (FR-M15-67..72, FR-M15-79; URS FT-M15-10.1): title block, balance card (token
 * and syiling from the M14 wallet read #17, caption with the viewer's tier rate, DV-M15-16), the ten
 * category chips as plain `?cat=` links and the empty state for every account and every `cat`
 * (BR-M15-26: no reward card, price, stock or "Tebus" control is built). `cat` only moves the active
 * chip; the items read (#19) is made for the contract and always answers an empty list.
 */
import { ClipboardList } from '@lucide/vue'
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

import { LoadingSpinner } from '@/components/feedback'
import { useApi } from '@/composables'
import { fetchGamificationWallet } from '@/modules/m14-gamification'

import { fetchDigitalItems } from '../api'
import { DIGITAL_CHIPS, activeChipKey } from '../components/digital-chips'
import { DIGITAL_COPY } from '../components/copy'
import LoadError from '../components/LoadError.vue'

const route = useRoute()
const cat = computed(() => route.query.cat)
const activeKey = computed(() => activeChipKey(cat.value))

const wallet = useApi((signal) => fetchGamificationWallet({ signal }))
const items = useApi(
  (signal) =>
    fetchDigitalItems({ ...(typeof cat.value === 'string' ? { cat: cat.value } : {}), signal }),
  [cat],
)

const failed = computed(() => wallet.error.value !== null || items.error.value !== null)
const ready = computed(() => wallet.data.value !== null && items.data.value !== null)

const CHIP =
  'inline-flex min-h-8 items-center gap-1 rounded-full px-4 text-xs font-semibold transition'
const CHIP_ON = 'bg-violet-600 text-white'
const CHIP_OFF = 'bg-white/70 text-slate-600 hover:bg-white'

function retry(): void {
  void wallet.reload()
  void items.reload()
}
</script>

<template>
  <div class="min-w-0 space-y-5" data-testid="m15-digital-page">
    <section class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div class="min-w-0">
        <h1 class="font-heading text-2xl font-bold text-slate-800" data-testid="digital-title">
          {{ DIGITAL_COPY.heading }}
        </h1>
        <p class="mt-1 text-sm text-slate-600">{{ DIGITAL_COPY.sub }}</p>
      </div>

      <div
        class="flex w-full items-center gap-3 rounded-2xl bg-linear-to-r from-purple-500 to-pink-500 px-4 py-3 text-white shadow-lg sm:w-fit sm:self-start lg:self-auto"
        data-testid="digital-card"
      >
        <div class="flex shrink-0 flex-col items-center text-center">
          <span class="text-xs text-white/90 uppercase" data-testid="digital-token-label">{{
            DIGITAL_COPY.tokenLabel
          }}</span>
          <span class="text-3xl leading-tight font-bold text-white" data-testid="digital-token">{{
            wallet.data.value?.tokenBalance ?? '…'
          }}</span>
        </div>
        <div class="h-12 w-px shrink-0 bg-white/30" />
        <div class="flex min-w-0 flex-col items-center text-center">
          <span class="text-xs text-white/90 uppercase" data-testid="digital-syiling-label">{{
            DIGITAL_COPY.syilingLabel
          }}</span>
          <span class="text-2xl leading-tight font-bold text-white" data-testid="digital-syiling">{{
            wallet.data.value?.currentSyiling ?? '…'
          }}</span>
          <span class="text-xs text-white/90" data-testid="digital-caption">{{
            wallet.data.value ? `${wallet.data.value.tier.conversionRate} syiling = 1 token` : ''
          }}</span>
        </div>
        <RouterLink
          to="/cikgu/hadiah/saya"
          class="inline-flex min-h-8 min-w-0 items-center gap-1.5 rounded-lg bg-white px-3 text-sm font-bold text-violet-700 hover:bg-violet-50"
          data-testid="digital-my-redemptions"
        >
          <ClipboardList class="h-4 w-4 shrink-0" />
          <span>{{ DIGITAL_COPY.myRedemptions }}</span>
        </RouterLink>
      </div>
    </section>

    <nav class="flex flex-wrap gap-2" data-testid="digital-chips">
      <RouterLink
        v-for="chip in DIGITAL_CHIPS"
        :key="chip.key"
        :to="{ path: '/cikgu/hadiah', query: { cat: chip.key } }"
        :class="[CHIP, activeKey === chip.key ? CHIP_ON : CHIP_OFF]"
        :data-active="activeKey === chip.key ? 'true' : 'false'"
        :data-testid="`digital-chip-${chip.key}`"
      >
        {{ chip.label }}
      </RouterLink>
    </nav>

    <LoadError v-if="failed" @retry="retry" />
    <div
      v-else-if="!ready"
      class="flex justify-center py-10 text-slate-400"
      data-testid="digital-loading"
    >
      <LoadingSpinner :size="28" />
    </div>
    <p v-else class="py-12 text-center text-base text-slate-400" data-testid="digital-empty">
      {{ DIGITAL_COPY.empty }}
    </p>
  </div>
</template>
