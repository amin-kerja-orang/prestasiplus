<script setup lang="ts">
/**
 * "Top Pelajar Minggu Ini" (FR-M17-29, FN-M17-3.3.6): up to 5 rows - rank, pupil link to S7,
 * "{n} jwb · {acc}%".
 */
import { DsEmptyState, DsListRow, DsStack, DsText, formatCount, formatPercent } from '@/ds'

import type { CcTopStudent } from '../../api/command-center-board'
import { ccPaths } from '../command-center/cc-paths'
import { S2_COPY } from './board-copy'
import BoardPanel from './BoardPanel.vue'

const props = defineProps<{ rows: CcTopStudent[] | null; basePath: string }>()
const paths = ccPaths(props.basePath)
</script>

<template>
  <BoardPanel icon="i-ph-star" title="Top Pelajar Minggu Ini" testid="cc-panel-top-pupils">
    <DsText v-if="rows === null" variant="body" tone="muted">{{ S2_COPY.loading }}</DsText>
    <DsEmptyState
      v-else-if="rows.length === 0"
      size="sm"
      :title="S2_COPY.noData"
      data-testid="cc-empty"
    />
    <DsStack v-else as="ul" gap="xs">
      <DsListRow
        v-for="(s, i) in rows"
        :key="s.studentId"
        :rank="i + 1"
        :title="s.name"
        :to="paths.student(s.studentId)"
        density="tight"
        data-testid="cc-top-pupil"
      >
        <template #meta
          ><span class="flex flex-col items-end" data-testid="cc-top-pupil-stat"
            ><span>{{ formatCount(s.answersCount) }} jwb</span
            ><span class="text-caption text-muted">{{ formatPercent(s.accuracy) }}</span></span
          ></template
        >
      </DsListRow>
    </DsStack>
  </BoardPanel>
</template>
