<script setup lang="ts">
/** S12 "📊 Kadar Penukaran Mengikut Peringkat" + tip (FN-M14-3.1.6, 3.1.7; FR-M14-32). */
import { formatCount } from '@/lib/number'

import type { TierGridItem } from '../../api'

defineProps<{ tiers: readonly TierGridItem[] }>()
</script>

<template>
  <UCard class="min-w-0" data-testid="s12-rates-card">
    <div class="flex flex-col gap-4">
      <h2 class="font-display text-subheading font-bold text-highlighted">
        📊 Kadar Penukaran Mengikut Peringkat
      </h2>
      <ul class="flex flex-col gap-2">
        <li
          v-for="t in tiers"
          :key="t.key"
          class="flex min-w-0 items-center gap-3 rounded-card p-3"
          :class="t.isMine ? 'bg-primary-soft' : 'bg-elevated'"
          data-testid="s12-tier"
        >
          <span class="text-title" aria-hidden="true">{{ t.icon }}</span>
          <div class="flex min-w-0 flex-1 flex-col">
            <p class="text-label text-highlighted">{{ t.labelMs }}</p>
            <p class="text-caption text-muted">{{ formatCount(t.minSyiling) }}+ syiling</p>
          </div>
          <UBadge v-if="t.isMine" color="secondary" variant="solid" size="sm" data-testid="s12-tier-mine"
            >ANDA</UBadge
          >
          <div class="shrink-0 text-end">
            <p class="tabular font-display text-heading font-extrabold text-highlighted">
              {{ t.conversionRate }}
            </p>
            <p class="text-caption text-muted">syiling/token</p>
          </div>
        </li>
      </ul>
      <UAlert color="info" variant="subtle" data-testid="s12-tip">
        <template #description>
          💡 <strong>Petua:</strong> Naik peringkat untuk dapatkan kadar penukaran yang lebih baik!
          Semakin tinggi peringkat, semakin sedikit syiling diperlukan untuk 1 token.
        </template>
      </UAlert>
    </div>
  </UCard>
</template>
