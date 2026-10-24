<script setup lang="ts">
/** S14 rows #4–#50 (FR-M14-41, FN-M14-5.1.3): rank, avatar, name, "{title} · Level {n}", score, tier emoji. */
import { DsLeaderRow } from '@/ds'
import { formatNumber } from '@/lib/number'

import type { LeaderboardRow } from '../../api'
import { LEADERBOARD_COPY } from '../../lib/student/leaderboard-lib'

defineProps<{ rows: readonly LeaderboardRow[] }>()
</script>

<template>
  <ul class="flex flex-col gap-2" data-testid="lb-rows">
    <DsLeaderRow
      v-for="row in rows"
      :key="row.rank"
      :rank="row.rank"
      :name="row.name"
      :school="`${row.title} · Tahap ${row.level}`"
      :points="formatNumber(row.totalSyilingEarned)"
      :unit="`${LEADERBOARD_COPY.syiling} ${row.tierIcon}`"
      data-testid="lb-row"
    />
  </ul>
</template>
