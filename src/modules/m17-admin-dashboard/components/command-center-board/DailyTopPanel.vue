<script setup lang="ts">
/** "Top Pelajar" of S3 (FR-M17-46, FN-M17-4.4.5): up to 5 rows - rank, pupil link to S7, school, "{n} jwb", accuracy. */
import { RouterLink } from 'vue-router'

import { formatCount, formatNumber } from '@/lib/number'

import type { CcDailyActivity } from '../../api/command-center-board'
import { ccPaths } from '../command-center/cc-paths'
import { RANK_BADGE, S3_COPY } from './board-copy'
import type { LoadStatus } from './composables'
import DailyPanel from './DailyPanel.vue'

const props = defineProps<{ data: CcDailyActivity | null; status: LoadStatus; basePath: string }>()
const paths = ccPaths(props.basePath)
</script>

<template>
  <DailyPanel title="Top Pelajar" dot="bg-amber-500" testid="cc-panel-daily-top" :state="status">
    <p
      v-if="!data || data.topStudents.length === 0"
      class="py-2 text-sm text-slate-400"
      data-testid="cc-empty"
    >
      {{ S3_COPY.noData }}
    </p>
    <ul v-else class="divide-y divide-slate-800">
      <li
        v-for="(s, i) in data.topStudents"
        :key="s.userId"
        class="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-0.5 py-1.5 text-sm"
        data-testid="cc-daily-top-row"
      >
        <span
          :class="[
            'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold',
            RANK_BADGE[i] ?? RANK_BADGE[3],
          ]"
          data-testid="cc-rank"
          >{{ i + 1 }}</span
        >
        <span class="min-w-0 flex-1">
          <RouterLink
            :to="paths.student(s.userId)"
            class="block font-semibold break-words text-slate-100 hover:text-indigo-300"
            data-testid="cc-daily-top-name"
            >{{ s.name }}</RouterLink
          >
          <span v-if="s.schoolName" class="block text-xs break-words text-slate-400">{{
            s.schoolName
          }}</span>
        </span>
        <span class="shrink-0 text-right font-mono">
          <b class="block text-slate-50" data-testid="cc-daily-top-answers"
            >{{ formatCount(s.answers) }} jwb</b
          >
          <span class="block text-xs text-emerald-400">{{
            `${formatNumber(s.accuracy, { decimals: 1 })}%`
          }}</span>
        </span>
      </li>
    </ul>
  </DailyPanel>
</template>
