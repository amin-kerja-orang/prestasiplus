<script setup lang="ts">
/**
 * S20 podium (FR-M08-116): the top 3 in the order 2-1-3. Avatar, name (truncated), "{n}% ketepatan",
 * coins and a base carrying the rank; the crown on rank 1. Below 640px the columns shrink so the page
 * does not scroll sideways (DV-10). Names are plain text: standings carry no user link.
 */
import { Coins } from '@lucide/vue'
import { computed } from 'vue'

import { formatNumber } from '@/lib/number'

import type { Leaderboard } from '../api/types'
import { initialOf, percentText } from '../lib/leaderboard'

type Row = Leaderboard['rows'][number]

const props = defineProps<{ rows: readonly Row[] }>()

/** Visual order 2, 1, 3 (a missing place is skipped). */
const podium = computed(() =>
  [props.rows[1], props.rows[0], props.rows[2]].filter((r): r is Row => r !== undefined),
)

const BASE: Record<number, string> = {
  1: 'h-24 bg-amber-400 sm:h-28',
  2: 'h-16 bg-slate-300 sm:h-20',
  3: 'h-12 bg-orange-300 sm:h-16',
}
</script>

<template>
  <div class="flex items-end justify-center gap-2 sm:gap-6" data-testid="podium">
    <div
      v-for="row in podium"
      :key="row.rank"
      class="flex w-[30%] min-w-0 flex-col items-center sm:w-32"
      :data-testid="`podium-${String(row.rank)}`"
    >
      <div v-if="row.rank === 1" class="text-2xl leading-none sm:text-3xl" aria-hidden="true">
        👑
      </div>
      <div
        class="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-amber-300 bg-white text-lg font-bold text-indigo-600 shadow sm:h-20 sm:w-20 sm:text-2xl"
      >
        <img
          v-if="row.avatarUrl"
          :src="row.avatarUrl"
          :alt="row.name"
          class="h-full w-full object-cover"
        />
        <span v-else>{{ initialOf(row.name) }}</span>
      </div>
      <p
        class="mt-2 w-full truncate text-center text-xs font-bold text-slate-800 sm:max-w-[110px] sm:text-sm"
        data-testid="podium-name"
      >
        {{ row.name }}
      </p>
      <p class="text-xs text-slate-500" data-testid="podium-accuracy">
        {{ percentText(row.accuracy) }} ketepatan
      </p>
      <p class="mt-0.5 flex items-center gap-1 text-xs font-bold text-amber-600 sm:text-sm">
        <Coins class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span data-testid="podium-coins">{{ formatNumber(row.coins) }}</span>
      </p>
      <div
        :class="[
          'mt-2 flex w-full items-center justify-center rounded-t-xl text-2xl font-bold text-white',
          BASE[row.rank],
        ]"
        data-testid="podium-base"
      >
        {{ row.rank }}
      </div>
    </div>
  </div>
</template>
