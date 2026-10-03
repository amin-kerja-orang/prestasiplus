<script setup lang="ts">
/**
 * "🏆 Leaderboard Minggu Ini" (FN-M10-2.2.5): medals then numbers, name, "{n} jwb", accuracy coloured; the
 * optional "Lencana Terbaru" block; a row opens the student page in a new tab.
 */
import { AppIcon } from '@/components/icon'

import type { CcRecentBadge, CcStudentRank } from '../../api/command-center-types'
import BoardPanel from './BoardPanel.vue'
import { useOpenTab } from './composables'
import { accuracyTone, S2_COPY, studentPath } from './copy'

defineProps<{ rows: CcStudentRank[]; badges: CcRecentBadge[] }>()
const openTab = useOpenTab()
const MEDALS = ['🥇', '🥈', '🥉']
</script>

<template>
  <BoardPanel icon="🏆" title="Leaderboard Minggu Ini" testid="cc-panel-leaderboard">
    <p v-if="rows.length === 0" class="text-sm text-slate-400" data-testid="cc-leaderboard-empty">
      {{ S2_COPY.noWeek }}
    </p>
    <ol v-else class="space-y-1">
      <li
        v-for="(r, i) in rows"
        :key="r.studentId"
        class="flex min-w-0 cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-slate-700/40"
        data-testid="cc-leaderboard-row"
        @click="openTab(studentPath(r.studentId))"
      >
        <span class="w-7 shrink-0 text-center font-mono text-slate-400">{{
          MEDALS[i] ?? i + 1
        }}</span>
        <span class="min-w-0 flex-1 font-semibold break-words text-slate-50">{{ r.name }}</span>
        <span class="shrink-0 font-mono text-slate-300">{{ r.answered }} jwb</span>
        <span :class="['w-12 shrink-0 text-right font-mono', accuracyTone(r.accuracy)]"
          >{{ r.accuracy }}%</span
        >
      </li>
    </ol>
    <div
      v-if="badges.length"
      class="mt-4 border-t border-slate-700 pt-3"
      data-testid="cc-recent-badges"
    >
      <h3 class="mb-2 text-xs font-bold tracking-widest text-slate-400 uppercase">
        Lencana Terbaru
      </h3>
      <ul class="space-y-1">
        <li
          v-for="(b, i) in badges"
          :key="i"
          class="flex min-w-0 items-center gap-2 text-sm text-slate-300"
        >
          <AppIcon :name="b.icon" class="h-4 w-4 shrink-0 text-amber-300" />
          <span class="min-w-0 break-words">{{ b.student }} — {{ b.badge }}</span>
        </li>
      </ul>
    </div>
  </BoardPanel>
</template>
