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
      <p
        v-if="!data || data.engagement.moodCheckins === 0"
        class="text-body text-muted"
        data-testid="cc-empty"
      >
        {{ S3_COPY.noData }}
      </p>
      <ul v-else class="grid grid-cols-2 gap-2">
        <li
          v-for="m in MOODS"
          :key="m.key"
          class="flex min-h-11 items-center gap-2 bg-soft px-3 text-body text-toned"
          :data-testid="`cc-daily-mood-${m.key}`"
        >
          <UIcon :name="m.icon" class="size-5 shrink-0" aria-hidden="true" />
          <span>{{ m.label }}</span>
          <span
            class="tabular ms-auto text-label text-highlighted"
            data-testid="cc-daily-mood-count"
            >{{ formatCount(data.engagement.moodDist[m.key]) }}</span
          >
        </li>
      </ul>
    </DailyPanel>
    <DailyPanel title="Badge Terkini" icon="i-ph-medal" testid="cc-panel-badges" :state="status">
      <p
        v-if="!data || data.engagement.recentBadges.length === 0"
        class="text-body text-muted"
        data-testid="cc-empty"
      >
        {{ S3_COPY.noBadges }}
      </p>
      <ul v-else class="flex flex-col gap-1">
        <li
          v-for="(b, i) in data.engagement.recentBadges"
          :key="i"
          class="flex min-h-11 flex-wrap items-center gap-x-2 gap-y-1 bg-soft px-3 py-2 text-body"
          data-testid="cc-badge-row"
        >
          <UIcon name="i-ph-medal" class="size-5 shrink-0 text-primary" aria-hidden="true" />
          <span class="min-w-0 text-label break-words text-highlighted">{{ b.name }}</span>
          <span class="text-caption text-muted">{{ b.badgeName }}</span>
        </li>
      </ul>
    </DailyPanel>
  </div>
</template>
