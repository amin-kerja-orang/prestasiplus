<script setup lang="ts">
/** S11 wallet tiles (FN-M14-2.1.5; FR-M14-17, BR-M14-05, 07): syiling, token, level with its XP bar, total. */
import { DsStatTile } from '@/ds'
import { formatCount } from '@/lib/number'

import type { GamificationWallet } from '../../api'
import { gamClampPct } from '../../lib/student/s11-format'

defineProps<{ wallet: GamificationWallet }>()
</script>

<template>
  <div class="grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="s11-stats">
    <DsStatTile
      art="coin"
      :value="formatCount(wallet.currentSyiling)"
      unit="Baki Syiling"
      :sub="`+${formatCount(wallet.earnedToday)} hari ini`"
      value-testid="s11-stat-syiling"
      sub-testid="s11-stat-today"
    />
    <DsStatTile
      art="bolt"
      :value="formatCount(wallet.tokenBalance)"
      unit="Baki Token"
      :sub="`${wallet.tier.conversionRate} syiling = 1 token`"
      value-testid="s11-stat-token"
      sub-testid="s11-stat-rate"
    />
    <DsStatTile
      icon="stack"
      accent="friend"
      :value="wallet.level"
      unit="Level"
      :sub="`${formatCount(wallet.xp)}/${formatCount(wallet.xpNeeded)} XP`"
      value-testid="s11-stat-level"
      sub-testid="s11-stat-xp"
    >
      <UProgress
        :model-value="gamClampPct(wallet.levelProgressPct)"
        :max="100"
        size="sm"
        class="w-full"
        aria-label="Level"
        :data-value="gamClampPct(wallet.levelProgressPct)"
        data-testid="s11-xp-bar"
      />
    </DsStatTile>
    <DsStatTile
      icon="i-ph-trend-up-duotone"
      accent="win"
      :value="formatCount(wallet.totalSyilingEarned)"
      unit="Jumlah Syiling"
      :sub="`+${formatCount(wallet.earnedThisWeek)} minggu ini`"
      value-testid="s11-stat-total"
      sub-testid="s11-stat-week"
    />
  </div>
</template>
