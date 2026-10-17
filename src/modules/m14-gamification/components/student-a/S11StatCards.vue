<script setup lang="ts">
/** S11 stat cards (FN-M14-2.1.5; FR-M14-17, BR-M14-05, 07). */
import { formatCount } from '@/lib/number'

import type { GamificationWallet } from '../../api'
import { gamClampPct } from '../../lib/student/s11-format'
import GamStat from './GamStat.vue'

defineProps<{ wallet: GamificationWallet }>()
</script>

<template>
  <div class="grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="s11-stats">
    <GamStat
      art="coin"
      :value="formatCount(wallet.currentSyiling)"
      label="Baki Syiling"
      :note="`+${formatCount(wallet.earnedToday)} hari ini`"
      value-testid="s11-stat-syiling"
      note-testid="s11-stat-today"
    />
    <GamStat
      art="bolt"
      :value="formatCount(wallet.tokenBalance)"
      label="Baki Token"
      :note="`${wallet.tier.conversionRate} syiling = 1 token`"
      value-testid="s11-stat-token"
      note-testid="s11-stat-rate"
    />
    <GamStat
      icon="i-ph-stack-duotone"
      accent="friend"
      :value="wallet.level"
      label="Level"
      :note="`${formatCount(wallet.xp)}/${formatCount(wallet.xpNeeded)} XP`"
      :progress="gamClampPct(wallet.levelProgressPct)"
      value-testid="s11-stat-level"
      note-testid="s11-stat-xp"
      bar-testid="s11-xp-bar"
    />
    <GamStat
      icon="i-ph-trend-up-duotone"
      accent="win"
      :value="formatCount(wallet.totalSyilingEarned)"
      label="Jumlah Syiling"
      :note="`+${formatCount(wallet.earnedThisWeek)} minggu ini`"
      value-testid="s11-stat-total"
      note-testid="s11-stat-week"
    />
  </div>
</template>
