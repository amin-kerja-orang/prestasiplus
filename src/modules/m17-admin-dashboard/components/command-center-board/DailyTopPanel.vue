<script setup lang="ts">
/** "Top Pelajar" of S3 (FR-M17-46, FN-M17-4.4.5): up to 5 rows - rank, pupil link to S7, school, "{n} jwb", accuracy. */
import { formatCount, formatNumber } from '@/lib/number'

import type { CcDailyActivity } from '../../api/command-center-board'
import { ccPaths } from '../command-center/cc-paths'
import { shortSchool } from '../command-center/cc-format'
import { rankColor, S3_COPY } from './board-copy'
import type { LoadStatus } from './composables'
import DailyPanel from './DailyPanel.vue'

const props = defineProps<{ data: CcDailyActivity | null; status: LoadStatus; basePath: string }>()
const paths = ccPaths(props.basePath)
</script>

<template>
  <DailyPanel title="Top Pelajar" icon="i-ph-star" testid="cc-panel-daily-top" :state="status">
    <p
      v-if="!data || data.topStudents.length === 0"
      class="py-2 text-body text-muted"
      data-testid="cc-empty"
    >
      {{ S3_COPY.noData }}
    </p>
    <ul v-else class="flex flex-col gap-1">
      <li
        v-for="(s, i) in data.topStudents"
        :key="s.userId"
        class="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1"
        data-testid="cc-daily-top-row"
      >
        <UBadge :color="rankColor(i)" variant="soft" class="shrink-0" data-testid="cc-rank">{{
          i + 1
        }}</UBadge>
        <span class="flex min-w-0 flex-1 flex-col">
          <UButton
            :to="paths.student(s.userId)"
            variant="link"
            color="neutral"
            class="h-auto justify-start p-0 text-start"
            :label="s.name"
            data-testid="cc-daily-top-name"
          />
          <span
            v-if="s.schoolName"
            class="text-caption break-words text-muted"
            :title="s.schoolName"
            >{{ shortSchool(s.schoolName) }}</span>
        </span>
        <span class="tabular flex shrink-0 flex-col text-end">
          <b class="text-label text-highlighted" data-testid="cc-daily-top-answers"
            >{{ formatCount(s.answers) }} jwb</b
          >
          <span class="text-caption text-success">{{
            `${formatNumber(s.accuracy, { decimals: 1 })}%`
          }}</span>
        </span>
      </li>
    </ul>
  </DailyPanel>
</template>
