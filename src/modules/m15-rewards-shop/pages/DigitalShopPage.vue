<script setup lang="ts">
/**
 * S10 `/cikgu/hadiah` (FR-M15-67..72, FR-M15-79; URS FT-M15-10.1): title block, balance card (token
 * and syiling from the M14 wallet read #17, caption with the viewer's tier rate, DV-M15-16), the ten
 * category chips as plain `?cat=` links and the empty state for every account and every `cat`
 * (BR-M15-26: no reward card, price, stock or "Tebus" control is built). `cat` only moves the active
 * chip; the items read (#19) is made for the contract and always answers an empty list.
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { useApi } from '@/composables'
import { DsEmptyState, DsPage, DsRewardChip, DsLoadError } from '@/ds'
import { fetchGamificationWallet } from '@/modules/m14-gamification'

import { fetchDigitalItems } from '../api'
import { DIGITAL_CHIPS, activeChipKey } from '../components/digital-chips'
import { DIGITAL_COPY } from '../components/copy'
import LoadSkeleton from '../components/LoadSkeleton.vue'
import { COMMON_COPY } from '../components/copy'

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

function retry(): void {
  void wallet.reload()
  void items.reload()
}
</script>

<template>
  <DsPage data-testid="m15-digital-page">
    <section class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div class="flex min-w-0 flex-col gap-1">
        <h1 class="text-title text-highlighted" data-testid="digital-title">
          {{ DIGITAL_COPY.heading }}
        </h1>
        <p class="text-body text-muted">{{ DIGITAL_COPY.sub }}</p>
      </div>

      <UCard class="w-full sm:w-fit" data-testid="digital-card">
        <div class="flex flex-wrap items-center gap-4">
          <div class="flex flex-col items-start gap-1">
            <span class="text-caption text-muted" data-testid="digital-token-label">{{
              DIGITAL_COPY.tokenLabel
            }}</span>
            <DsRewardChip
              :value="wallet.data.value?.tokenBalance ?? '…'"
              art="bolt"
              data-testid="digital-token"
            />
          </div>
          <div class="flex min-w-0 flex-col items-start gap-1">
            <span class="text-caption text-muted" data-testid="digital-syiling-label">{{
              DIGITAL_COPY.syilingLabel
            }}</span>
            <DsRewardChip
              :value="wallet.data.value?.currentSyiling ?? '…'"
              art="coin"
              data-testid="digital-syiling"
            />
            <span class="text-caption text-muted" data-testid="digital-caption">{{
              wallet.data.value ? `${wallet.data.value.tier.conversionRate} syiling = 1 token` : ''
            }}</span>
          </div>
          <UButton
            to="/cikgu/hadiah/saya"
            size="lg"
            color="neutral"
            variant="soft"
            icon="i-ph-clipboard-text-duotone"
            class="min-h-11"
            data-testid="digital-my-redemptions"
          >
            {{ DIGITAL_COPY.myRedemptions }}
          </UButton>
        </div>
      </UCard>
    </section>

    <nav class="flex gap-2 overflow-x-auto sm:flex-wrap" data-testid="digital-chips">
      <UButton
        v-for="chip in DIGITAL_CHIPS"
        :key="chip.key"
        :to="{ path: '/cikgu/hadiah', query: { cat: chip.key } }"
        size="lg"
        class="min-h-11 shrink-0"
        :color="activeKey === chip.key ? 'primary' : 'neutral'"
        :variant="activeKey === chip.key ? 'solid' : 'soft'"
        :data-active="activeKey === chip.key ? 'true' : 'false'"
        :data-testid="`digital-chip-${chip.key}`"
      >
        {{ chip.label }}
      </UButton>
    </nav>

    <DsLoadError v-if="failed" :message="COMMON_COPY.loadFailed" testid="m15-load-error" retry-testid="m15-retry" @retry="retry" />
    <LoadSkeleton v-else-if="!ready" testid="digital-loading" />
    <div v-else data-testid="digital-empty">
      <DsEmptyState :title="DIGITAL_COPY.empty" icon="gift" />
    </div>
  </DsPage>
</template>
