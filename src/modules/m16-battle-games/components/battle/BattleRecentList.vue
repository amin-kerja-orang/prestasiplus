<script setup lang="ts">
/**
 * S4 "Battle Terkini" rows and S5 history rows (FN-M16-3.3.5, 2.6.2; BR-M16-14, BR-M16-37).
 * Player A is neutral when A's current school is the viewed school (`homeHere`), else primary; player B
 * is always primary; the winner's score is green (a 0-0 row has winner B, DV-M16-35; a tie none). The
 * row wraps below 768 px instead of scrolling sideways (v2: no horizontal scroll).
 */
import type { BattleListRow } from '../../api'
import { battleRelativeTime } from './battle-lib'

defineProps<{
  rows: readonly BattleListRow[]
  /** Colour player A by `homeHere` (S4); S5 passes `false` (both sides primary). */
  homeColour?: boolean
}>()
</script>

<template>
  <div data-testid="battle-recent-scroll">
    <ul class="flex flex-col gap-2" data-testid="battle-recent-list">
      <li
        v-for="row in rows"
        :key="row.uuid"
        class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-card bg-elevated px-3 py-2"
        data-testid="battle-recent-row"
      >
        <span class="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 text-body">
          <span
            class="text-label"
            :class="homeColour && row.playerA.homeHere ? 'text-highlighted' : 'text-primary'"
            data-testid="battle-player-a"
            >{{ row.playerA.name }}</span
          >
          <span
            class="tabular text-label"
            :class="row.winner === 'A' ? 'text-success' : 'text-muted'"
            data-testid="battle-score-a"
            >{{ row.scoreA }}</span
          >
          <span class="text-caption text-muted">vs</span>
          <span
            class="tabular text-label"
            :class="row.winner === 'B' ? 'text-success' : 'text-muted'"
            data-testid="battle-score-b"
            >{{ row.scoreB }}</span
          >
          <span class="text-label text-primary" data-testid="battle-player-b">{{
            row.playerB.name
          }}</span>
        </span>
        <span class="shrink-0 text-caption text-muted" data-testid="battle-time">{{
          battleRelativeTime(row.createdAt)
        }}</span>
      </li>
    </ul>
  </div>
</template>
