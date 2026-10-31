<script setup lang="ts">
/** "Top Pelajar" of S3 (FR-M17-46, FN-M17-4.4.5): up to 5 rows - rank, pupil link to S7, school, "{n} jwb", accuracy. */
import { DsEmptyState, DsListRow, DsStack, formatCount, formatPercent } from '@/ds'

import type { CcDailyActivity } from '../../api/command-center-board'
import { ccPaths } from '../command-center/cc-paths'
import { shortSchool } from '../command-center/cc-format'
import { S3_COPY } from './board-copy'
import type { LoadStatus } from './composables'
import DailyPanel from './DailyPanel.vue'

const props = defineProps<{ data: CcDailyActivity | null; status: LoadStatus; basePath: string }>()
const paths = ccPaths(props.basePath)
</script>

<template>
  <DailyPanel title="Top Pelajar" icon="i-ph-star" testid="cc-panel-daily-top" :state="status">
    <DsEmptyState
      v-if="!data || data.topStudents.length === 0"
      size="sm"
      :title="S3_COPY.noData"
      data-testid="cc-empty"
    />
    <DsStack v-else as="ul" gap="xs">
      <DsListRow
        v-for="(s, i) in data.topStudents"
        :key="s.userId"
        :rank="i + 1"
        :title="s.name"
        :sub="s.schoolName ? shortSchool(s.schoolName) : undefined"
        :to="paths.student(s.userId)"
        density="tight"
        data-testid="cc-daily-top-row"
      >
        <template #meta
          ><span class="flex flex-col items-end"
            ><span data-testid="cc-daily-top-answers">{{ formatCount(s.answers) }} jwb</span
            ><span class="text-caption text-success">{{ formatPercent(s.accuracy) }}</span></span
          ></template
        >
      </DsListRow>
    </DsStack>
  </DailyPanel>
</template>
