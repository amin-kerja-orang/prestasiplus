<script setup lang="ts">
/** S11 "Sistem Tier" (FN-M14-2.1.9; FR-M14-21): active tiers in sort order, the viewer's tier marked. */
import { DsIconChip, DsStack, DsGrid, DsText } from '@/ds'
import { formatCount } from '@/lib/number'

import type { TierGridItem } from '../../api'

defineProps<{ tiers: readonly TierGridItem[]; currentKey: string }>()
</script>

<template>
  <UCard class="min-w-0" data-testid="s11-tiers">
    <DsStack gap="sm">
      <h2 class="flex items-center gap-2 font-display text-subheading font-bold text-highlighted">
        <DsIconChip icon="crown" accent="trial" size="sm" />Sistem Tier
      </h2>
      <DsGrid :cols="{ base: 2, lg: 4 }" gap="sm">
        <div
          v-for="t in tiers"
          :key="t.key"
          class="flex min-w-0 flex-col items-center gap-1 rounded-card p-3 text-center"
          :class="t.key === currentKey ? 'bg-primary-soft' : 'bg-elevated'"
          :aria-current="t.key === currentKey ? 'true' : undefined"
          data-testid="s11-tier"
        >
          <span class="text-title" aria-hidden="true">{{ t.icon }}</span>
          <DsText variant="label" as="p" tone="highlighted">{{ t.labelMs }}</DsText>
          <DsText variant="caption">{{ formatCount(t.minSyiling) }}+ syiling</DsText>
          <DsText variant="caption">{{ t.conversionRate }} syiling = 1 token</DsText>
          <UBadge
            v-if="t.key === currentKey"
            color="secondary"
            variant="solid"
            size="sm"
            data-testid="s11-tier-mine"
            >✨ ANDA DI SINI</UBadge
          >
        </div>
      </DsGrid>
    </DsStack>
  </UCard>
</template>
