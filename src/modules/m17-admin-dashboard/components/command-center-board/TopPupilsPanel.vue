<script setup lang="ts">
/**
 * "⭐ Top Pelajar Minggu Ini" (FR-M17-29, FN-M17-3.3.6): up to 5 rows - medal 🥇🥈🥉 then "⚬", pupil link to
 * S7, "{n} jwb · {acc}%".
 */
import { RouterLink } from 'vue-router'

import { formatCount, formatNumber } from '@/lib/number'

import type { CcTopStudent } from '../../api/command-center-board'
import { ccPaths } from '../command-center/cc-paths'
import { MEDALS, S2_COPY } from './board-copy'
import BoardPanel from './BoardPanel.vue'

const props = defineProps<{ rows: CcTopStudent[] | null; basePath: string }>()
const paths = ccPaths(props.basePath)
</script>

<template>
  <BoardPanel icon="⭐" title="Top Pelajar Minggu Ini" testid="cc-panel-top-pupils">
    <p v-if="rows === null" class="text-sm text-slate-400">{{ S2_COPY.loading }}</p>
    <p v-else-if="rows.length === 0" class="text-sm text-slate-400" data-testid="cc-empty">
      {{ S2_COPY.noData }}
    </p>
    <ul v-else class="space-y-1">
      <li
        v-for="(s, i) in rows"
        :key="s.studentId"
        class="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-0.5 xl:min-h-7"
        data-testid="cc-top-pupil"
      >
        <span class="w-7 shrink-0 text-center text-lg" data-testid="cc-medal">{{
          MEDALS[i] ?? '⚬'
        }}</span>
        <RouterLink
          :to="paths.student(s.studentId)"
          class="min-w-0 flex-1 font-semibold break-words text-slate-100 hover:text-indigo-300"
          data-testid="cc-top-pupil-link"
          >{{ s.name }}</RouterLink
        >
        <span class="shrink-0 font-mono text-sm text-slate-400" data-testid="cc-top-pupil-stat"
          >{{ formatCount(s.answersCount) }} jwb ·
          {{ formatNumber(s.accuracy, { decimals: 1 }) }}%</span
        >
      </li>
    </ul>
  </BoardPanel>
</template>
