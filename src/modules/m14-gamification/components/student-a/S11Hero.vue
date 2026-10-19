<script setup lang="ts">
/** S11 hero (FN-M14-2.1.1–2.1.4; FR-M14-14, 15, 16): tier badge, title chip, figures, next-tier bar, buttons. */
import { computed } from 'vue'

import { DsRewardChip, DsStack, DsCluster, DsGrid, DsText } from '@/ds'
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
    <DsStack>
      <DsCluster gap="md" justify="between">
        <div class="flex min-w-0 items-center gap-3 sm:gap-4">
          <UAvatar
            :text="wallet.tier.icon"
            size="3xl"
            class="bg-elevated"
            data-testid="s11-tier-icon"
          />
          <DsStack gap="2xs" align="start">
            <UBadge variant="soft" color="primary" data-testid="s11-title-chip">{{
              titleChip
            }}</UBadge>
            <h1
              class="font-display text-title font-extrabold text-highlighted"
              data-testid="s11-tier-name"
            >
              {{ wallet.tier.labelMs }} Tier
            </h1>
            <DsText variant="label" as="p" tone="muted" data-testid="s11-level"
              >Level {{ wallet.level }}</DsText
            >
          </DsStack>
        </div>
        <DsCluster gap="md" align="stretch" :wrap="false" class="shrink-0 text-center">
          <DsStack gap="2xs" align="center">
            <DsRewardChip
              art="coin"
              :value="formatCount(wallet.currentSyiling)"
              data-testid="s11-hero-syiling"
            />
            <DsText variant="caption" as="span">Syiling 💰</DsText>
          </DsStack>
          <DsStack gap="2xs" align="center">
            <DsRewardChip
              art="bolt"
              :value="formatCount(wallet.tokenBalance)"
              data-testid="s11-hero-token"
            />
            <DsText variant="caption" as="span">Token 🎫</DsText>
          </DsStack>
        </DsCluster>
      </DsCluster>

      <DsStack v-if="next" gap="xs" data-testid="s11-next-tier">
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
          aria-label="Kemajuan ke tier seterusnya"
          :data-value="pct"
          data-testid="s11-next-bar"
        />
        <DsText variant="caption" data-testid="s11-next-need">
          Perlu {{ formatCount(need) }} syiling lagi
        </DsText>
      </DsStack>

      <DsGrid :cols="{ base: 1, sm: 3 }" gap="xs">
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
      </DsGrid>
    </DsStack>
  </UCard>
</template>
