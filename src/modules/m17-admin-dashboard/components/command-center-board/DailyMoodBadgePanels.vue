<script setup lang="ts">
/**
 * "Mood Pelajar" and "Badge Terkini" of S3 (FR-M17-47, FN-M17-4.4.6, 4.4.7): the period's mood check-ins as four
 * tiles ("Tiada data" when none) and the badges earned ("Tiada data" when none). Two cards, stacked.
 */
import { DsEmptyState, DsIconChip, DsListRow, DsStack, formatCount } from '@/ds'

import type { CcDailyActivity } from '../../api/command-center-board'
import { MOODS, S3_COPY } from './board-copy'
import type { LoadStatus } from './composables'
import DailyPanel from './DailyPanel.vue'

withDefaults(
  defineProps<{ data: CcDailyActivity | null; status: LoadStatus; only?: 'mood' | 'badge' }>(),
  { only: undefined },
)
</script>

<template>
  <DailyPanel
    v-if="only !== 'badge'"
    title="Mood Pelajar"
    icon="i-ph-smiley"
    testid="cc-panel-daily-mood"
    :state="status"
    :stretch="false"
  >
    <DsEmptyState
      v-if="!data || data.engagement.moodCheckins === 0"
      size="sm"
      :title="S3_COPY.noData"
      data-testid="cc-empty"
    />
    <DsStack v-else as="ul" gap="xs">
      <DsListRow
        v-for="m in MOODS"
        :key="m.key"
        :title="m.label"
        density="tight"
        :data-testid="`cc-daily-mood-${m.key}`"
      >
        <template #leading
          ><DsIconChip :icon="m.icon.replace('i-ph-', '')" :accent="m.accent" size="sm"
        /></template>
        <template #meta
          ><span data-testid="cc-daily-mood-count">{{
            formatCount(data.engagement.moodDist[m.key])
          }}</span></template
        >
      </DsListRow>
    </DsStack>
  </DailyPanel>
  <DailyPanel
    v-if="only !== 'mood'"
    title="Badge Terkini"
    icon="i-ph-medal"
    testid="cc-panel-badges"
    :state="status"
    :stretch="false"
  >
    <DsEmptyState
      v-if="!data || data.engagement.recentBadges.length === 0"
      size="sm"
      :title="S3_COPY.noBadges"
      data-testid="cc-empty"
    />
    <DsStack v-else as="ul" gap="xs">
      <DsListRow
        v-for="(b, i) in data.engagement.recentBadges"
        :key="i"
        :title="b.name"
        :sub="b.badgeName"
        density="tight"
        data-testid="cc-badge-row"
      >
        <template #leading><DsIconChip icon="medal" accent="win" size="sm" /></template>
      </DsListRow>
    </DsStack>
  </DailyPanel>
</template>
