<script setup lang="ts">
/** S11 "Sistem Peringkat" (FN-M14-2.1.9; FR-M14-21): active tiers in sort order, the viewer's tier marked. */
import { DsIconChip } from '@/ds'
import { formatCount } from '@/lib/number'

import type { TierGridItem } from '../../api'

defineProps<{ tiers: readonly TierGridItem[]; currentKey: string }>()
</script>

<template>
  <UCard class="min-w-0" data-testid="s11-tiers">
    <div class="flex flex-col gap-3">
      <h2 class="flex items-center gap-2 font-display text-subheading font-bold text-highlighted">
        <DsIconChip icon="crown" accent="trial" size="sm" />Sistem Peringkat
      </h2>
      <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div
          v-for="t in tiers"
          :key="t.key"
          class="flex min-w-0 flex-col items-center gap-1 rounded-card p-3 text-center"
          :class="t.key === currentKey ? 'bg-primary-soft' : 'bg-elevated'"
          :aria-current="t.key === currentKey ? 'true' : undefined"
          data-testid="s11-tier"
        >
          <span class="text-title" aria-hidden="true">{{ t.icon }}</span>
          <p class="text-label text-highlighted">{{ t.labelMs }}</p>
          <p class="text-caption text-muted">{{ formatCount(t.minSyiling) }}+ syiling</p>
          <p class="text-caption text-muted">{{ t.conversionRate }} syiling = 1 token</p>
          <UBadge
            v-if="t.key === currentKey"
            color="secondary"
            variant="solid"
            size="sm"
            data-testid="s11-tier-mine"
            >✨ ANDA DI SINI</UBadge
          >
        </div>
      </div>
    </div>
  </UCard>
</template>
