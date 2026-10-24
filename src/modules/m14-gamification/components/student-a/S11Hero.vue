<script setup lang="ts">
/** S11 hero (FN-M14-2.1.1–2.1.4; FR-M14-14, 15, 16): tier badge, title chip, figures, next-tier bar, buttons. */
import { computed } from 'vue'

import { DsRewardChip } from '@/ds'
import { formatCount, formatPercent } from '@/lib/number'

import type { GamificationWallet } from '../../api'
import { gamClampPct, gamNextTierPct } from '../../lib/student/s11-format'

const props = defineProps<{ wallet: GamificationWallet }>()

const next = computed(() => props.wallet.nextTier)
const pct = computed(() =>
  next.value ? gamNextTierPct(props.wallet.currentSyiling, next.value.minSyiling) : 0,
)
const need = computed(() =>
  next.value ? Math.max(0, next.value.minSyiling - props.wallet.currentSyiling) : 0,
)
const titleChip = computed(() =>
  `${props.wallet.title.emoji ?? ''} ${props.wallet.title.name}`.trim(),
)
</script>

<template>
  <UCard data-testid="s11-hero">
    <div class="flex flex-col gap-4">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div class="flex min-w-0 items-center gap-3 sm:gap-4">
          <UAvatar
            :text="wallet.tier.icon"
            size="3xl"
            class="bg-elevated"
            data-testid="s11-tier-icon"
          />
          <div class="flex min-w-0 flex-col items-start gap-1">
            <UBadge variant="soft" color="primary" data-testid="s11-title-chip">{{
              titleChip
            }}</UBadge>
            <h1
              class="font-display text-title font-extrabold text-highlighted"
              data-testid="s11-tier-name"
            >
              {{ wallet.tier.labelMs }} Tier
            </h1>
            <p class="text-label text-muted" data-testid="s11-level">Level {{ wallet.level }}</p>
          </div>
        </div>
        <div class="flex shrink-0 gap-4 text-center">
          <div class="flex flex-col items-center gap-1">
            <DsRewardChip
              art="coin"
              :value="formatCount(wallet.currentSyiling)"
              data-testid="s11-hero-syiling"
            />
            <span class="text-caption text-muted">Syiling 💰</span>
          </div>
          <div class="flex flex-col items-center gap-1">
            <DsRewardChip
              art="bolt"
              :value="formatCount(wallet.tokenBalance)"
              data-testid="s11-hero-token"
            />
            <span class="text-caption text-muted">Token 🎫</span>
          </div>
        </div>
      </div>

      <div v-if="next" class="flex flex-col gap-2" data-testid="s11-next-tier">
        <div class="flex items-center justify-between gap-3 text-label text-highlighted">
          <span
            >⬆️ Naik ke <strong>{{ next.labelMs }}</strong></span
          >
          <span class="tabular" data-testid="s11-next-pct">{{
            formatPercent(pct, { decimals: 1 })
          }}</span>
        </div>
        <UProgress
          :model-value="gamClampPct(pct)"
          :max="100"
          color="secondary"
          aria-label="Kemajuan ke peringkat seterusnya"
          :data-value="pct"
          data-testid="s11-next-bar"
        />
        <p class="text-caption text-muted" data-testid="s11-next-need">
          Perlu {{ formatCount(need) }} syiling lagi
        </p>
      </div>

      <div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <UButton
          to="/gamification/convert"
          size="xl"
          color="primary"
          icon="i-ph-arrows-left-right-duotone"
          block
          data-testid="s11-btn-convert"
          >Tukar Token</UButton
        >
        <UButton
          to="/gamification/challenges"
          size="xl"
          color="neutral"
          variant="soft"
          icon="i-ph-target-duotone"
          block
          data-testid="s11-btn-challenges"
          >Cabaran Harian</UButton
        >
        <UButton
          to="/gamification/rewards"
          size="xl"
          color="neutral"
          variant="soft"
          icon="i-ph-gift-duotone"
          block
          data-testid="s11-btn-rewards"
          >Kedai Hadiah</UButton
        >
      </div>
    </div>
  </UCard>
</template>
