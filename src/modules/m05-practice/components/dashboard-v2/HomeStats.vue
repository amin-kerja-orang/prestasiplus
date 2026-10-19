<script setup lang="ts">
/** The five stat cards (FR-M05-10, 11): Syiling Kamu, Mata (Lvl n), Hari Berturut, Sesi Minggu Ini, Ketepatan. */
import { DsStatTile, DsGrid } from '@/ds'

import type { Dashboard } from '../../api/types'
import { COUNT_RULES } from '../dashboard/dashboard-lib'
import { useDisplayCount } from './useDisplayCount'

const props = defineProps<Pick<Dashboard, 'wallet' | 'streak' | 'week'>>()

const coins = useDisplayCount(() => props.wallet.coins, COUNT_RULES.coins)
const points = useDisplayCount(() => props.wallet.points, COUNT_RULES.points)
const streak = useDisplayCount(() => props.streak.count, COUNT_RULES.streak)
const sessions = useDisplayCount(() => props.week.sessions, COUNT_RULES.sessions)
const accuracy = useDisplayCount(() => props.week.accuracyPct, COUNT_RULES.accuracy)
</script>

<template>
  <DsGrid
    :cols="{ base: 2, md: 3 }"
    gap="sm"
    as="ul"
    aria-label="Statistik awak"
    data-testid="dash-stats"
  >
    <li class="min-w-0" data-testid="dash-stat-coins">
      <DsStatTile :value="coins" unit="Syiling Kamu" icon="coins" accent="win" />
    </li>
    <li class="min-w-0" data-testid="dash-stat-points">
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
    <li class="min-w-0" data-testid="dash-stat-streak">
      <DsStatTile :value="streak" unit="Hari Berturut" icon="fire" accent="heat" />
    </li>
    <li class="min-w-0" data-testid="dash-stat-sessions">
      <DsStatTile :value="sessions" unit="Sesi Minggu Ini" icon="books" accent="friend" />
    </li>
    <li class="col-span-2 min-w-0 md:col-span-1" data-testid="dash-stat-accuracy">
      <DsStatTile :value="`${accuracy}%`" unit="Ketepatan" icon="star" accent="trial" />
    </li>
  </DsGrid>
</template>
