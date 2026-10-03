<script setup lang="ts">
/** S12 "📊 Kadar Penukaran Mengikut Tier" + tip (FN-M14-3.1.6, 3.1.7; FR-M14-32). */
import { formatCount } from '@/lib/number'

import type { TierGridItem } from '../../api'
import { gamTierColor, gamTierTextColor, gamTierTint } from '../../lib/student/s11-format'

defineProps<{ tiers: readonly TierGridItem[] }>()
</script>

<template>
  <section class="min-w-0 rounded-2xl bg-white p-4 shadow sm:p-6" data-testid="s12-rates-card">
    <h2 class="font-heading text-lg font-bold">📊 Kadar Penukaran Mengikut Tier</h2>
    <div class="mt-4 space-y-3">
      <div
        v-for="t in tiers"
        :key="t.key"
        class="flex min-w-0 items-center gap-3 rounded-xl border-2 p-3"
        :style="{
          backgroundColor: gamTierTint(gamTierColor(t.key, t.color)),
          borderColor: t.isMine ? gamTierColor(t.key, t.color) : 'transparent',
        }"
        data-testid="s12-tier"
      >
        <span class="text-2xl">{{ t.icon }}</span>
        <div class="min-w-0 flex-1">
          <p class="font-semibold" :style="{ color: gamTierTextColor(t.key, t.color) }">
            {{ t.labelMs }}
          </p>
          <p class="text-xs text-slate-500">{{ formatCount(t.minSyiling) }}+ syiling</p>
        </div>
        <span
          v-if="t.isMine"
          class="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700"
          data-testid="s12-tier-mine"
          >ANDA</span
        >
        <div class="shrink-0 text-right">
          <p class="text-xl font-bold text-slate-800">{{ t.conversionRate }}</p>
          <p class="text-xs text-slate-500">syiling/token</p>
        </div>
      </div>
    </div>
    <p class="mt-4 rounded-xl bg-blue-50 p-3 text-xs text-blue-700" data-testid="s12-tip">
      💡 <strong>Tips:</strong> Naik tier untuk dapatkan kadar penukaran yang lebih baik! Semakin
      tinggi tier, semakin sedikit syiling diperlukan untuk 1 token.
    </p>
  </section>
</template>
