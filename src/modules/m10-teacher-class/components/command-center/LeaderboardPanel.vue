<script setup lang="ts">
/**
 * "Leaderboard Minggu Ini" (FN-M10-2.2.5): rank, name, "{n} jwb", accuracy coloured; the optional
 * "Lencana Terbaru" block; a row opens the student page in a new tab.
 */
import type { CcRecentBadge, CcStudentRank } from '../../api/command-center-types'
import BoardPanel from './BoardPanel.vue'
import { useOpenTab } from './composables'
import { accuracyTone, S2_COPY, studentPath } from './copy'

defineProps<{ rows: CcStudentRank[]; badges: CcRecentBadge[] }>()
const openTab = useOpenTab()
</script>

<template>
  <BoardPanel icon="trophy" accent="win" title="Leaderboard Minggu Ini" testid="cc-panel-leaderboard">
    <p v-if="rows.length === 0" class="text-body text-muted" data-testid="cc-leaderboard-empty">
      {{ S2_COPY.noWeek }}
    </p>
    <ol v-else class="flex flex-col gap-1">
      <li v-for="(r, i) in rows" :key="r.studentId" class="min-w-0">
        <UButton
          color="neutral"
          variant="ghost"
          block
          class="h-auto min-w-0 justify-start gap-3 px-2 py-2 text-start"
          data-testid="cc-leaderboard-row"
          @click="openTab(studentPath(r.studentId))"
        >
          <UBadge :color="i < 3 ? 'primary' : 'neutral'" variant="soft" class="shrink-0">{{
            i + 1
          }}</UBadge>
          <span class="min-w-0 flex-1 text-label break-words text-highlighted">{{ r.name }}</span>
          <span class="tabular shrink-0 text-body text-toned">{{ r.answered }} jwb</span>
          <span :class="['tabular w-12 shrink-0 text-end text-body', accuracyTone(r.accuracy)]"
            >{{ r.accuracy }}%</span
          >
        </UButton>
      </li>
    </ol>
    <div v-if="badges.length" class="mt-4 flex flex-col gap-2" data-testid="cc-recent-badges">
      <h3 class="text-overline text-muted">Lencana Terbaru</h3>
      <ul class="flex flex-col gap-1">
        <li
          v-for="(b, i) in badges"
          :key="i"
          class="flex min-w-0 items-center gap-2 text-body text-toned"
        >
          <UIcon name="i-ph-medal" class="size-5 shrink-0 text-primary-t" />
          <span class="min-w-0 break-words">{{ b.student }} — {{ b.badge }}</span>
        </li>
      </ul>
    </div>
  </BoardPanel>
</template>
