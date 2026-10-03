<script setup lang="ts">
/** S11 "Sistem Tier" (FN-M14-2.1.9; FR-M14-21): active tiers in sort order, the viewer's tier marked. */
import { Crown } from '@lucide/vue'

import { formatCount } from '@/lib/number'

import type { TierGridItem } from '../../api'
import { gamTierColor, gamTierTextColor, gamTierTint } from '../../lib/student/s11-format'

defineProps<{ tiers: readonly TierGridItem[]; currentKey: string }>()
</script>

<template>
  <section class="min-w-0 rounded-2xl bg-white p-4 shadow sm:p-5" data-testid="s11-tiers">
    <h2 class="flex items-center gap-2 font-heading text-lg font-semibold">
      <Crown class="h-5 w-5 text-amber-500" />Sistem Tier
    </h2>
    <div class="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <div
        v-for="t in tiers"
        :key="t.key"
        class="min-w-0 rounded-xl border-2 p-3 text-center"
        :style="{
          backgroundColor: gamTierTint(gamTierColor(t.key, t.color)),
          borderColor: t.key === currentKey ? gamTierColor(t.key, t.color) : 'transparent',
        }"
        data-testid="s11-tier"
      >
        <div class="text-3xl">{{ t.icon }}</div>
        <p class="font-semibold" :style="{ color: gamTierTextColor(t.key, t.color) }">
          {{ t.labelMs }}
        </p>
        <p class="text-xs text-slate-500">{{ formatCount(t.minSyiling) }}+ syiling</p>
        <p class="text-xs text-slate-500">{{ t.conversionRate }} syiling = 1 token</p>
        <p
          v-if="t.key === currentKey"
          class="mt-1 text-xs font-bold text-amber-600"
          data-testid="s11-tier-mine"
        >
          ✨ ANDA DI SINI
        </p>
      </div>
    </div>
  </section>
</template>
