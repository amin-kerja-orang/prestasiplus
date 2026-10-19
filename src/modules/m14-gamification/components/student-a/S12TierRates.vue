<script setup lang="ts">
/** S12 "📊 Kadar Penukaran Mengikut Tier" + tip (FN-M14-3.1.6, 3.1.7; FR-M14-32). */
import { formatCount } from '@/lib/number'

import type { TierGridItem } from '../../api'
import { DsStack, DsText } from '@/ds'

defineProps<{ tiers: readonly TierGridItem[] }>()
</script>

<template>
  <UCard class="min-w-0" data-testid="s12-rates-card">
    <DsStack>
      <h2 class="font-display text-subheading font-bold text-highlighted">
        📊 Kadar Penukaran Mengikut Tier
      </h2>
      <DsStack as="ul" gap="xs">
        <li
          v-for="t in tiers"
          :key="t.key"
          class="flex min-w-0 items-center gap-3 rounded-card p-3"
          :class="t.isMine ? 'bg-primary-soft' : 'bg-elevated'"
          data-testid="s12-tier"
        >
          <DsText variant="title" as="span" aria-hidden="true">{{ t.icon }}</DsText>
          <div class="flex min-w-0 flex-1 flex-col">
            <DsText variant="label" as="p" tone="highlighted">{{ t.labelMs }}</DsText>
            <DsText variant="caption">{{ formatCount(t.minSyiling) }}+ syiling</DsText>
          </div>
          <UBadge
            v-if="t.isMine"
            color="secondary"
            variant="solid"
            size="sm"
            data-testid="s12-tier-mine"
            >ANDA</UBadge
          >
          <div class="shrink-0 text-end">
            <p class="tabular font-display text-heading font-extrabold text-highlighted">
              {{ t.conversionRate }}
            </p>
            <DsText variant="caption">syiling/token</DsText>
          </div>
        </li>
      </DsStack>
      <UAlert color="info" variant="subtle" data-testid="s12-tip">
        <template #description>
          💡 <strong>Tips:</strong> Naik tier untuk dapatkan kadar penukaran yang lebih baik!
          Semakin tinggi tier, semakin sedikit syiling diperlukan untuk 1 token.
        </template>
      </UAlert>
    </DsStack>
  </UCard>
</template>
