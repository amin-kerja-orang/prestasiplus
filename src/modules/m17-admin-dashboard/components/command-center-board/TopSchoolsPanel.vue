<script setup lang="ts">
/** "Sekolah Teratas" (FR-M17-24, FN-M17-3.3.1): up to 5 rows, rank badge, school link to S4, "{n} plj". */
import { formatCount } from '@/lib/number'

import type { CcTopSchool } from '../../api/command-center-board'
import { ccPaths } from '../command-center/cc-paths'
import { shortSchool } from '../command-center/cc-format'
import { rankColor, S2_COPY } from './board-copy'
import BoardPanel from './BoardPanel.vue'

const props = defineProps<{ rows: CcTopSchool[] | null; basePath: string }>()
const paths = ccPaths(props.basePath)
</script>

<template>
  <BoardPanel icon="i-ph-trophy" title="Sekolah Teratas" testid="cc-panel-top-schools">
    <p v-if="rows === null" class="text-body text-muted">{{ S2_COPY.loading }}</p>
    <p v-else-if="rows.length === 0" class="text-body text-muted" data-testid="cc-empty">
      {{ S2_COPY.noData }}
    </p>
    <ul v-else class="flex flex-col gap-1">
      <li
        v-for="(s, i) in rows"
        :key="s.schoolId"
        class="flex min-h-11 items-center gap-3"
        data-testid="cc-top-school"
      >
        <UBadge :color="rankColor(i)" variant="soft" class="shrink-0" data-testid="cc-rank">{{
          i + 1
        }}</UBadge>
        <UButton
          :to="paths.school(s.schoolId)"
          variant="link"
          color="neutral"
          class="h-auto min-w-0 flex-1 justify-start p-0 text-start"
          :label="shortSchool(s.schoolName)"
          :title="s.schoolName"
          data-testid="cc-top-school-link"
        />
        <span class="tabular shrink-0 text-body text-muted" data-testid="cc-top-school-count"
          >{{ formatCount(s.activeCount) }} plj</span
        >
      </li>
    </ul>
  </BoardPanel>
</template>
