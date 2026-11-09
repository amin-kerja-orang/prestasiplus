<script setup lang="ts">
/** The five stat cards (FR-M05-10, 11): Syiling Kamu, Mata (Lvl n), Hari Berturut, Sesi Minggu Ini, Ketepatan. */
import { computed } from 'vue'

import { DsStatTile, tileLayout } from '@/ds'

import type { Dashboard } from '../../api/types'
import { accuracyDisplay, COUNT_RULES } from '../dashboard/dashboard-lib'
import { useDisplayCount } from './useDisplayCount'

const props = defineProps<Pick<Dashboard, 'wallet' | 'streak' | 'week' | 'accuracyPct'>>()

const coins = useDisplayCount(() => props.wallet.coins, COUNT_RULES.coins)
const points = useDisplayCount(() => props.wallet.points, COUNT_RULES.points)
const streak = useDisplayCount(() => props.streak.count, COUNT_RULES.streak)
const sessions = useDisplayCount(() => props.week.sessions, COUNT_RULES.sessions)
// Pooled accuracy (top-level field): "—" with no answers (no count-up), else the half-up whole number.
const accuracy = useDisplayCount(
  () => (props.accuracyPct === null ? 0 : Math.floor(props.accuracyPct + 0.5)),
  COUNT_RULES.accuracy,
)
const accuracyText = computed(() =>
  props.accuracyPct === null ? accuracyDisplay(null) : `${accuracy.value}%`,
)

// Five tiles: 1 + 2 + 2 below md, 3 + 2 at md, five across at xl (no orphan cell).
const layout = tileLayout(5)
</script>

<template>
  <ul
    class="grid gap-3"
    :class="layout.grid"
    aria-label="Statistik awak"
    data-testid="dash-stats"
  >
    <li class="min-w-0" :class="layout.span[0]" data-testid="dash-stat-coins">
      <DsStatTile :value="coins" unit="Syiling Kamu" icon="coins" accent="win" />
    </li>
    <li class="min-w-0" :class="layout.span[1]" data-testid="dash-stat-points">
      <DsStatTile
        :value="points"
        :unit="`Mata (Lvl ${wallet.level})`"
        icon="lightning"
        accent="action"
      />
      <UProgress
        :model-value="wallet.levelProgressPct"
        :max="100"
        size="sm"
        class="mt-2"
        aria-label="Kemajuan tahap"
        data-testid="dash-level-bar"
      />
    </li>
    <li class="min-w-0" :class="layout.span[2]" data-testid="dash-stat-streak">
      <DsStatTile :value="streak" unit="Hari Berturut" icon="fire" accent="heat" />
    </li>
    <li class="min-w-0" :class="layout.span[3]" data-testid="dash-stat-sessions">
      <DsStatTile
        :value="sessions"
        unit="Sesi Minggu Ini"
        icon="books"
        accent="friend"
      />
    </li>
    <li class="min-w-0" :class="layout.span[4]" data-testid="dash-stat-accuracy">
      <DsStatTile
        :value="accuracyText"
        unit="Ketepatan"
        icon="star"
        accent="trial"
      />
    </li>
  </ul>
</template>
