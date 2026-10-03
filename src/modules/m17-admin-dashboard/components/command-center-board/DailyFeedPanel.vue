<script setup lang="ts">
/** "Live Feed" of S3 (FR-M17-43, FN-M17-4.4.3): the period's latest answers - time, name, subject, ✓/✗. */
import { RouterLink } from 'vue-router'

import type { CcDailyActivity } from '../../api/command-center-board'
import { ccPaths } from '../command-center/cc-paths'
import { S3_COPY } from './board-copy'
import type { LoadStatus } from './composables'
import DailyPanel from './DailyPanel.vue'

const props = defineProps<{ data: CcDailyActivity | null; status: LoadStatus; basePath: string }>()
const paths = ccPaths(props.basePath)
</script>

<template>
  <DailyPanel title="Live Feed" dot="bg-rose-500" testid="cc-panel-daily-feed" :state="status">
    <p
      v-if="!data || data.liveFeed.length === 0"
      class="py-6 text-center text-sm text-slate-400"
      data-testid="cc-empty"
    >
      {{ S3_COPY.noActivity }}
    </p>
    <ul v-else class="divide-y divide-slate-800">
      <li
        v-for="(r, i) in data.liveFeed"
        :key="i"
        class="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-0.5 py-1 text-sm"
        data-testid="cc-daily-feed-row"
      >
        <span class="shrink-0 font-mono text-xs text-slate-400">{{ r.time }}</span>
        <RouterLink
          :to="paths.student(r.studentId)"
          class="min-w-0 font-semibold break-words text-slate-100 hover:text-indigo-300"
          >{{ r.student }}</RouterLink
        >
        <span class="shrink-0 text-xs text-slate-300">{{ r.subject }}</span>
        <span
          :class="['ml-auto shrink-0 font-bold', r.correct ? 'text-emerald-400' : 'text-rose-400']"
          >{{ r.correct ? '✓' : '✗' }}</span
        >
      </li>
    </ul>
  </DailyPanel>
</template>
