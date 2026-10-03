<script setup lang="ts">
/** S14 rows #4–#50 (FR-M14-41, FN-M14-5.1.3): "#{rank}", initials avatar, name, "{title} · Level {n}", score, tier emoji. */
import { formatNumber } from '@/lib/number'

import type { LeaderboardRow } from '../../api'
import { LEADERBOARD_COPY } from '../../lib/student/leaderboard-lib'

defineProps<{ rows: readonly LeaderboardRow[] }>()
</script>

<template>
  <div class="rounded-3xl bg-white px-4 py-2 shadow sm:px-6" data-testid="lb-rows">
    <div
      v-for="row in rows"
      :key="row.rank"
      class="lb-row flex items-center gap-3 border-b border-slate-100 py-3 last:border-b-0"
      data-testid="lb-row"
    >
      <span
        class="w-9 shrink-0 text-center text-base font-bold text-slate-500"
        data-testid="lb-row-rank"
        >#{{ row.rank }}</span
      >
      <span
        class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-slate-200 bg-slate-100 text-sm font-bold text-indigo-600"
        data-testid="lb-row-avatar"
        >{{ row.initials }}</span
      >
      <div class="min-w-0 flex-1">
        <div class="truncate text-sm font-bold text-slate-800" data-testid="lb-row-name">
          {{ row.name }}
        </div>
        <div class="text-xs text-slate-400" data-testid="lb-row-title">
          {{ row.title }} · Level {{ row.level }}
        </div>
      </div>
      <div class="shrink-0 text-right">
        <div class="text-sm font-bold text-slate-800" data-testid="lb-row-score">
          {{ formatNumber(row.totalSyilingEarned) }}
        </div>
        <div class="text-xs text-slate-400">{{ LEADERBOARD_COPY.syiling }}</div>
      </div>
      <span class="shrink-0 text-xl" data-testid="lb-row-tier">{{ row.tierIcon }}</span>
    </div>
  </div>
</template>
