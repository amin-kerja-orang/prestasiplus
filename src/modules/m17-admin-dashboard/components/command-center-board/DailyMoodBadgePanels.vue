<script setup lang="ts">
/**
 * "Mood Pelajar" and "Badge Terkini" of S3 (FR-M17-47, FN-M17-4.4.6, 4.4.7): the period's mood check-ins as four
 * emoji tiles ("Tiada data" when none) and the badges earned ("Tiada badge baru" when none). Two cards, stacked.
 */
import { formatCount } from '@/lib/number'

import type { CcDailyActivity } from '../../api/command-center-board'
import { MOODS, S3_COPY } from './board-copy'
import type { LoadStatus } from './composables'
import DailyPanel from './DailyPanel.vue'

defineProps<{ data: CcDailyActivity | null; status: LoadStatus }>()
</script>

<template>
  <div class="flex min-w-0 flex-col gap-3 md:col-span-2 xl:col-span-1">
    <DailyPanel
      title="Mood Pelajar"
      dot="bg-violet-500"
      testid="cc-panel-daily-mood"
      :state="status"
    >
      <p
        v-if="!data || data.engagement.moodCheckins === 0"
        class="text-sm text-slate-400"
        data-testid="cc-empty"
      >
        {{ S3_COPY.noData }}
      </p>
      <ul v-else class="grid grid-cols-2 gap-2">
        <li
          v-for="m in MOODS"
          :key="m.key"
          class="flex min-h-11 items-center gap-2 rounded-lg bg-slate-800 px-3 text-sm text-slate-300"
          :data-testid="`cc-daily-mood-${m.key}`"
        >
          <span class="text-xl">{{ m.emoji }}</span>
          <span>{{ m.label }}</span>
          <span class="ml-auto font-mono text-slate-100" data-testid="cc-daily-mood-count">{{
            formatCount(data.engagement.moodDist[m.key])
          }}</span>
        </li>
      </ul>
    </DailyPanel>
    <DailyPanel title="Badge Terkini" dot="bg-rose-500" testid="cc-panel-badges" :state="status">
      <p
        v-if="!data || data.engagement.recentBadges.length === 0"
        class="text-sm text-slate-400"
        data-testid="cc-empty"
      >
        {{ S3_COPY.noBadges }}
      </p>
      <ul v-else class="divide-y divide-slate-800">
        <li
          v-for="(b, i) in data.engagement.recentBadges"
          :key="i"
          class="flex min-h-11 flex-wrap items-center gap-x-2 gap-y-0.5 py-1 text-sm"
          data-testid="cc-badge-row"
        >
          <span class="text-lg">{{ b.icon }}</span>
          <span class="min-w-0 font-semibold break-words text-slate-100">{{ b.name }}</span>
          <span class="text-xs text-slate-400">{{ b.badgeName }}</span>
        </li>
      </ul>
    </DailyPanel>
  </div>
</template>
