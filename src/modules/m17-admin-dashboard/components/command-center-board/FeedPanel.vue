<script setup lang="ts">
/**
 * "⚡ Live Feed" (FR-M17-28, FN-M17-3.3.5): the 10 latest answers - time, pupil, subject, school (cut to 15
 * characters, link to S4, full name in `title`), "✓" / "✗". Names are text, never HTML (DV-M17-26).
 */
import { RouterLink } from 'vue-router'

import type { CcFeedRow } from '../../api/command-center-board'
import { ccPaths } from '../command-center/cc-paths'
import { S2_COPY } from './board-copy'
import BoardPanel from './BoardPanel.vue'

const props = defineProps<{ rows: CcFeedRow[] | null; basePath: string }>()
const paths = ccPaths(props.basePath)
</script>

<template>
  <BoardPanel icon="⚡" title="Live Feed" testid="cc-panel-feed">
    <p v-if="rows === null" class="text-sm text-slate-400">{{ S2_COPY.loading }}</p>
    <p v-else-if="rows.length === 0" class="text-sm text-slate-400" data-testid="cc-empty">
      {{ S2_COPY.noFeed }}
    </p>
    <ul v-else class="divide-y divide-slate-700/60">
      <li
        v-for="(r, i) in rows"
        :key="i"
        class="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-0.5 py-1 text-sm xl:min-h-7"
        data-testid="cc-feed-row"
      >
        <span class="shrink-0 font-mono text-xs text-slate-400" data-testid="cc-feed-time">{{
          r.time
        }}</span>
        <span class="min-w-0 font-semibold break-words text-slate-100" data-testid="cc-feed-name">{{
          r.student
        }}</span>
        <span class="shrink-0 text-xs text-slate-300" data-testid="cc-feed-subject">{{
          r.subject
        }}</span>
        <RouterLink
          v-if="r.schoolId !== null && r.schoolName"
          :to="paths.school(r.schoolId)"
          :title="r.schoolName"
          class="min-w-0 text-xs text-slate-400 hover:text-indigo-300"
          data-testid="cc-feed-school"
          >{{ r.schoolName.slice(0, 15) }}</RouterLink
        >
        <span
          :class="['ml-auto shrink-0 font-bold', r.correct ? 'text-emerald-400' : 'text-rose-400']"
          data-testid="cc-feed-mark"
          >{{ r.correct ? '✓' : '✗' }}</span
        >
      </li>
    </ul>
  </BoardPanel>
</template>
