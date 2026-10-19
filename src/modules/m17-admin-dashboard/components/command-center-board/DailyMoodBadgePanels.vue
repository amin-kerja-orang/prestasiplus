<script setup lang="ts">
/**
 * "Mood Pelajar" and "Badge Terkini" of S3 (FR-M17-47, FN-M17-4.4.6, 4.4.7): the period's mood check-ins as four
 * tiles ("Tiada data" when none) and the badges earned ("Tiada badge baru" when none). Two cards, stacked.
 */
import { formatCount } from '@/lib/number'

import type { CcDailyActivity } from '../../api/command-center-board'
import { MOODS, S3_COPY } from './board-copy'
import type { LoadStatus } from './composables'
import DailyPanel from './DailyPanel.vue'
import { DsGrid, DsStack, DsText } from '@/ds'

defineProps<{ data: CcDailyActivity | null; status: LoadStatus }>()
</script>

<template>
  <div class="flex min-w-0 flex-col gap-4 md:col-span-2 xl:col-span-1">
    <DailyPanel
      title="Mood Pelajar"
      icon="i-ph-smiley"
      testid="cc-panel-daily-mood"
      :state="status"
    >
      <DsText
        v-if="!data || data.engagement.moodCheckins === 0"
        variant="body"
        tone="muted"
        data-testid="cc-empty"
      >
        {{ S3_COPY.noData }}
      </DsText>
      <DsGrid v-else :cols="2" gap="xs" as="ul">
        <li
          v-for="m in MOODS"
          :key="m.key"
          class="flex min-h-11 items-center gap-2 bg-soft px-3 text-body text-toned"
          :data-testid="`cc-daily-mood-${m.key}`"
        >
          <UIcon :name="m.icon" class="size-5 shrink-0" aria-hidden="true" />
          <span>{{ m.label }}</span>
          <DsText
            variant="label"
            tone="highlighted"
            tabular
            class="ms-auto"
            data-testid="cc-daily-mood-count"
            >{{ formatCount(data.engagement.moodDist[m.key]) }}</DsText
          >
        </li>
      </DsGrid>
    </DailyPanel>
    <DailyPanel title="Badge Terkini" icon="i-ph-medal" testid="cc-panel-badges" :state="status">
      <DsText
        v-if="!data || data.engagement.recentBadges.length === 0"
        variant="body"
        tone="muted"
        data-testid="cc-empty"
      >
        {{ S3_COPY.noBadges }}
      </DsText>
      <DsStack v-else as="ul" gap="2xs">
        <li
          v-for="(b, i) in data.engagement.recentBadges"
          :key="i"
          class="flex min-h-11 flex-wrap items-center gap-x-2 gap-y-1 bg-soft px-3 py-2 text-body"
          data-testid="cc-badge-row"
        >
          <UIcon name="i-ph-medal" class="size-5 shrink-0 text-primary-t" aria-hidden="true" />
          <DsText variant="label" tone="highlighted" wrap="anywhere" class="min-w-0">{{
            b.name
          }}</DsText>
          <DsText variant="caption" as="span">{{ b.badgeName }}</DsText>
        </li>
      </DsStack>
    </DailyPanel>
  </div>
</template>
