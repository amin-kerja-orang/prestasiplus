<script setup lang="ts">
/** "🏆 Top Sekolah" (FR-M17-24, FN-M17-3.3.1): up to 5 rows, rank badge r1-r5, school link to S4, "{n} plj". */
import { RouterLink } from 'vue-router'

import { formatCount } from '@/lib/number'

import type { CcTopSchool } from '../../api/command-center-board'
import { ccPaths } from '../command-center/cc-paths'
import { RANK_BADGE, S2_COPY } from './board-copy'
import BoardPanel from './BoardPanel.vue'

const props = defineProps<{ rows: CcTopSchool[] | null; basePath: string }>()
const paths = ccPaths(props.basePath)
</script>

<template>
  <BoardPanel icon="🏆" title="Top Sekolah" testid="cc-panel-top-schools">
    <p v-if="rows === null" class="text-sm text-slate-400">{{ S2_COPY.loading }}</p>
    <p v-else-if="rows.length === 0" class="text-sm text-slate-400" data-testid="cc-empty">
      {{ S2_COPY.noData }}
    </p>
    <ul v-else class="space-y-1">
      <li
        v-for="(s, i) in rows"
        :key="s.schoolId"
        class="flex min-h-11 items-center gap-3"
        data-testid="cc-top-school"
      >
        <span
          :class="[
            'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold',
            RANK_BADGE[i],
          ]"
          data-testid="cc-rank"
          >{{ i + 1 }}</span
        >
        <RouterLink
          :to="paths.school(s.schoolId)"
          class="min-w-0 flex-1 text-base font-medium break-words text-slate-100 hover:text-indigo-300 xl:truncate"
          data-testid="cc-top-school-link"
          >{{ s.schoolName }}</RouterLink
        >
        <span class="shrink-0 font-mono text-sm text-slate-400" data-testid="cc-top-school-count"
          >{{ formatCount(s.activeCount) }} plj</span
        >
      </li>
    </ul>
  </BoardPanel>
</template>
