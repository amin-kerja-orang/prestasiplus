<script setup lang="ts">
/** S11 hero (FN-M14-2.1.1–2.1.4; FR-M14-14, 15, 16): tier badge, title chip, figures, next-tier bar, buttons. */
import { ArrowRightLeft, Gift, Target } from '@lucide/vue'
import { computed } from 'vue'

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
  <section
    class="gam-hero min-w-0 rounded-3xl bg-linear-to-br from-blue-800 via-violet-600 to-pink-500 p-4 text-white shadow-lg sm:p-6"
    data-testid="s11-hero"
  >
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div class="flex min-w-0 items-center gap-3 sm:gap-4">
        <div
          class="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 border-white/30 bg-white/10 text-3xl"
          data-testid="s11-tier-icon"
        >
          {{ wallet.tier.icon }}
        </div>
        <div class="min-w-0">
          <span
            class="inline-block rounded-full bg-white/20 px-3 py-0.5 text-xs font-semibold"
            data-testid="s11-title-chip"
            >{{ titleChip }}</span
          >
          <h1 class="mt-1 font-heading text-2xl font-bold text-white" data-testid="s11-tier-name">
            {{ wallet.tier.labelMs }} Tier
          </h1>
          <p class="text-sm text-white/80" data-testid="s11-level">Level {{ wallet.level }}</p>
        </div>
      </div>
      <div class="flex shrink-0 gap-5 text-center sm:gap-6">
        <div>
          <p class="text-2xl font-bold text-white" data-testid="s11-hero-syiling">
            {{ formatCount(wallet.currentSyiling) }}
          </p>
          <p class="text-xs text-white/80">Syiling 💰</p>
        </div>
        <div>
          <p class="text-2xl font-bold text-white" data-testid="s11-hero-token">
            {{ formatCount(wallet.tokenBalance) }}
          </p>
          <p class="text-xs text-white/80">Token 🎫</p>
        </div>
      </div>
    </div>

    <div v-if="next" class="mt-4 rounded-xl bg-white/10 p-3" data-testid="s11-next-tier">
      <div class="flex items-center justify-between gap-3 text-sm font-medium">
        <span
          >⬆️ Naik ke <strong>{{ next.labelMs }}</strong></span
        >
        <span data-testid="s11-next-pct">{{ formatPercent(pct, { decimals: 1 }) }}</span>
      </div>
      <div class="mt-2 h-2 overflow-hidden rounded-full bg-white/20">
        <div
          class="h-full rounded-full bg-amber-400"
          :style="{ width: `${gamClampPct(pct)}%` }"
          data-testid="s11-next-bar"
        />
      </div>
      <p class="mt-2 text-xs text-white/80" data-testid="s11-next-need">
        Perlu {{ formatCount(need) }} syiling lagi
      </p>
    </div>

    <div class="mt-4 flex flex-wrap gap-3">
      <RouterLink
        to="/gamification/convert"
        class="inline-flex min-h-11 items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-amber-600"
        data-testid="s11-btn-convert"
      >
        <ArrowRightLeft class="h-4 w-4" />Tukar Token
      </RouterLink>
      <RouterLink
        to="/gamification/challenges"
        class="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-600"
        data-testid="s11-btn-challenges"
      >
        <Target class="h-4 w-4" />Cabaran Harian
      </RouterLink>
      <RouterLink
        to="/gamification/rewards"
        class="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-600"
        data-testid="s11-btn-rewards"
      >
        <Gift class="h-4 w-4" />Kedai Hadiah
      </RouterLink>
    </div>
  </section>
</template>
