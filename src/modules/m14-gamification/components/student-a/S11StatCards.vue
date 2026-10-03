<script setup lang="ts">
/** S11 stat cards (FN-M14-2.1.5; FR-M14-17, BR-M14-05, 07). */
import { Coins, Layers, Ticket, TrendingUp } from '@lucide/vue'

import { formatCount } from '@/lib/number'

import type { GamificationWallet } from '../../api'
import { gamClampPct } from '../../lib/student/s11-format'

defineProps<{ wallet: GamificationWallet }>()
</script>

<template>
  <div class="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4" data-testid="s11-stats">
    <div class="min-w-0 rounded-2xl border-t-4 border-amber-400 bg-white p-4 shadow">
      <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400 text-white">
        <Coins class="h-5 w-5" />
      </div>
      <p class="mt-2 text-2xl font-bold text-slate-800" data-testid="s11-stat-syiling">
        {{ formatCount(wallet.currentSyiling) }}
      </p>
      <p class="text-sm text-slate-500">Baki Syiling</p>
      <p class="text-xs font-medium text-green-600" data-testid="s11-stat-today">
        +{{ formatCount(wallet.earnedToday) }} hari ini
      </p>
    </div>
    <div class="min-w-0 rounded-2xl border-t-4 border-blue-500 bg-white p-4 shadow">
      <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500 text-white">
        <Ticket class="h-5 w-5" />
      </div>
      <p class="mt-2 text-2xl font-bold text-slate-800" data-testid="s11-stat-token">
        {{ formatCount(wallet.tokenBalance) }}
      </p>
      <p class="text-sm text-slate-500">Baki Token</p>
      <p class="text-xs font-medium text-blue-600" data-testid="s11-stat-rate">
        {{ wallet.tier.conversionRate }} syiling = 1 token
      </p>
    </div>
    <div class="min-w-0 rounded-2xl border-t-4 border-purple-500 bg-white p-4 shadow">
      <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500 text-white">
        <Layers class="h-5 w-5" />
      </div>
      <p class="mt-2 text-2xl font-bold text-slate-800" data-testid="s11-stat-level">
        {{ wallet.level }}
      </p>
      <p class="text-sm text-slate-500">Level</p>
      <p class="text-xs font-medium text-purple-600" data-testid="s11-stat-xp">
        {{ formatCount(wallet.xp) }}/{{ formatCount(wallet.xpNeeded) }} XP
      </p>
      <div class="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          class="h-full rounded-full bg-purple-500"
          :style="{ width: `${gamClampPct(wallet.levelProgressPct)}%` }"
          data-testid="s11-xp-bar"
        />
      </div>
    </div>
    <div class="min-w-0 rounded-2xl border-t-4 border-emerald-500 bg-white p-4 shadow">
      <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 text-white">
        <TrendingUp class="h-5 w-5" />
      </div>
      <p class="mt-2 text-2xl font-bold text-slate-800" data-testid="s11-stat-total">
        {{ formatCount(wallet.totalSyilingEarned) }}
      </p>
      <p class="text-sm text-slate-500">Jumlah Syiling</p>
      <p class="text-xs font-medium text-green-600" data-testid="s11-stat-week">
        +{{ formatCount(wallet.earnedThisWeek) }} minggu ini
      </p>
    </div>
  </div>
</template>
