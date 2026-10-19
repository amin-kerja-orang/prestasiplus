<script setup lang="ts">
/**
 * "Leaderboard Minggu Ini" (FN-M10-2.2.5): rank, name, "{n} jwb", accuracy coloured; the optional
 * "Lencana Terbaru" block; a row opens the student page in a new tab.
 */
import type { CcRecentBadge, CcStudentRank } from '../../api/command-center-types'
import BoardPanel from './BoardPanel.vue'
import { useOpenTab } from './composables'
import { accuracyTone, S2_COPY, studentPath } from './copy'
import { DsStack, DsText, DsHeading } from '@/ds'

defineProps<{ rows: CcStudentRank[]; badges: CcRecentBadge[] }>()
const openTab = useOpenTab()
</script>

<template>
  <BoardPanel
    icon="trophy"
    accent="win"
    title="Leaderboard Minggu Ini"
    testid="cc-panel-leaderboard"
  >
    <DsText v-if="rows.length === 0" variant="body" tone="muted" data-testid="cc-leaderboard-empty">
      {{ S2_COPY.noWeek }}
    </DsText>
    <DsStack v-else as="ol" gap="2xs">
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
          <DsText variant="body" as="span" tone="toned" tabular class="shrink-0"
            >{{ r.answered }} jwb</DsText
          >
          <span :class="['tabular w-12 shrink-0 text-end text-body', accuracyTone(r.accuracy)]"
            >{{ r.accuracy }}%</span
          >
        </UButton>
      </li>
    </DsStack>
    <div v-if="badges.length" class="mt-4 flex flex-col gap-2" data-testid="cc-recent-badges">
      <DsHeading :level="3" variant="overline" tone="muted">Lencana Terbaru</DsHeading>
      <DsStack as="ul" gap="2xs">
        <li
          v-for="(b, i) in badges"
          :key="i"
          class="flex min-w-0 items-center gap-2 text-body text-toned"
        >
          <UIcon name="i-ph-medal" class="size-5 shrink-0 text-primary-t" />
          <span class="min-w-0 break-words">{{ b.student }} — {{ b.badge }}</span>
        </li>
      </DsStack>
    </div>
  </BoardPanel>
</template>
