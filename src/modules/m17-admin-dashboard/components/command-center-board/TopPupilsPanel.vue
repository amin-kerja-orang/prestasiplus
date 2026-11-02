<script setup lang="ts">
/**
 * "Top Pelajar Minggu Ini" (FR-M17-29, FN-M17-3.3.6): up to 5 rows - rank, pupil link to S7,
 * "{n} jwb · {acc}%".
 */
import { formatCount, formatNumber } from '@/lib/number'

import type { CcTopStudent } from '../../api/command-center-board'
import { ccPaths } from '../command-center/cc-paths'
import { rankColor, S2_COPY } from './board-copy'
import BoardPanel from './BoardPanel.vue'

const props = defineProps<{ rows: CcTopStudent[] | null; basePath: string }>()
const paths = ccPaths(props.basePath)
</script>

<template>
  <BoardPanel icon="i-ph-star" title="Top Pelajar Minggu Ini" testid="cc-panel-top-pupils">
    <p v-if="rows === null" class="text-body text-muted">{{ S2_COPY.loading }}</p>
    <p v-else-if="rows.length === 0" class="text-body text-muted" data-testid="cc-empty">
      {{ S2_COPY.noData }}
    </p>
    <ul v-else class="flex flex-col gap-1">
      <li
        v-for="(s, i) in rows"
        :key="s.studentId"
        class="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1"
        data-testid="cc-top-pupil"
      >
        <UBadge :color="rankColor(i)" variant="soft" class="shrink-0" data-testid="cc-medal">{{
          i + 1
        }}</UBadge>
        <UButton
          :to="paths.student(s.studentId)"
          variant="link"
          color="neutral"
          class="h-auto min-w-0 flex-1 justify-start p-0 text-start"
          :label="s.name"
          :title="s.name"
          data-testid="cc-top-pupil-link"
        />
        <span class="tabular shrink-0 text-body text-muted" data-testid="cc-top-pupil-stat"
          >{{ formatCount(s.answersCount) }} jwb ·
          {{ formatNumber(s.accuracy, { decimals: 1 }) }}%</span
        >
      </li>
    </ul>
  </BoardPanel>
</template>
