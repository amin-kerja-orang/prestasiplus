<script setup lang="ts">
/**
 * S4 "Battle Terkini" rows and S5 history rows (FN-M16-3.3.5, 2.6.2; BR-M16-14, BR-M16-37).
 * Player A is slate when A's current school is the viewed school (`homeHere`), else blue; player B
 * is always blue; the winner's score is green (a 0-0 row has winner B, DV-M16-35; a tie none). The
 * list scrolls inside its own box below 768 px (DV-M16-37), never the page.
 */
import type { BattleListRow } from '../../api'
import { battleRelativeTime } from './battle-lib'

defineProps<{
  rows: readonly BattleListRow[]
  /** Colour player A by `homeHere` (S4); S5 passes `false` (both sides blue). */
  homeColour?: boolean
}>()
</script>

<template>
  <div class="overflow-x-auto" data-testid="battle-recent-scroll">
    <ul class="min-w-[26rem] space-y-2" data-testid="battle-recent-list">
      <li
        v-for="row in rows"
        :key="row.uuid"
        class="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 text-sm"
        data-testid="battle-recent-row"
      >
        <span class="flex min-w-0 flex-1 items-center gap-2 whitespace-nowrap">
          <span
            class="font-semibold"
            :class="homeColour && row.playerA.homeHere ? 'text-slate-700' : 'text-blue-600'"
            data-testid="battle-player-a"
            >{{ row.playerA.name }}</span
          >
          <span
            class="font-bold"
            :class="row.winner === 'A' ? 'text-green-600' : 'text-slate-500'"
            data-testid="battle-score-a"
            >{{ row.scoreA }}</span
          >
          <span class="text-xs text-slate-400">vs</span>
          <span
            class="font-bold"
            :class="row.winner === 'B' ? 'text-green-600' : 'text-slate-500'"
            data-testid="battle-score-b"
            >{{ row.scoreB }}</span
          >
          <span class="font-semibold text-blue-600" data-testid="battle-player-b">{{
            row.playerB.name
          }}</span>
        </span>
        <span class="shrink-0 text-xs whitespace-nowrap text-slate-400" data-testid="battle-time">{{
          battleRelativeTime(row.createdAt)
        }}</span>
      </li>
    </ul>
  </div>
</template>
