<script setup lang="ts">
/**
 * S20 podium (FR-M08-116): the top 3 in the order 2-1-3. Avatar, name (truncated), "{n}% ketepatan",
 * coins and a base carrying the rank; the crown on rank 1. Below 640px the columns shrink so the page
 * does not scroll sideways (DV-10). Names are plain text: standings carry no user link.
 */
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

/** Only first place is the focus point (lime); 2nd and 3rd stay neutral. */
const BASE: Record<number, string> = {
  1: 'h-24 bg-highlight text-on-highlight sm:h-28',
  2: 'h-16 bg-elevated text-highlighted sm:h-20',
  3: 'h-12 bg-elevated text-highlighted sm:h-16',
}
</script>

<template>
  <div class="flex items-end justify-center gap-2 sm:gap-6" data-testid="podium">
    <div
      v-for="(row, i) in podium"
      :key="`${String(row.rank)}-${String(i)}`"
      class="flex min-w-0 flex-1 flex-col items-center sm:w-32 sm:flex-none"
      :data-testid="`podium-${String(row.rank)}`"
    >
      <div v-if="row.rank === 1" class="leading-none" aria-hidden="true">
        <UIcon name="i-ph-crown-simple-duotone" class="size-7 text-primary-t sm:size-8" />
        <span class="sr-only">👑</span>
      </div>
      <UAvatar
        :src="row.avatarUrl ?? undefined"
        :alt="row.name"
        :text="initialOf(row.name)"
        class="size-12 sm:size-20"
      />
      <p
        class="mt-2 w-full truncate text-center text-label text-highlighted sm:max-w-28"
        data-testid="podium-name"
      >
        {{ row.name }}
      </p>
      <p class="text-caption text-muted" data-testid="podium-accuracy">
        {{ percentText(row.accuracy) }} ketepatan
      </p>
      <p class="tabular mt-0.5 flex items-center gap-1 text-label text-highlighted">
        <UIcon name="i-ph-coins" class="size-4 shrink-0" aria-hidden="true" />
        <span data-testid="podium-coins">{{ formatNumber(row.coins) }}</span>
      </p>
      <div
        :class="[
          'tabular mt-2 flex w-full items-center justify-center rounded-t-card font-display text-heading font-extrabold',
          BASE[row.rank],
        ]"
        data-testid="podium-base"
      >
        {{ row.rank }}
      </div>
    </div>
  </div>
</template>
