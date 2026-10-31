<script setup lang="ts">
/** "Top Sekolah" (FR-M17-24, FN-M17-3.3.1): up to 5 rows, rank, school link to S4, "{n} plj". */
import { DsEmptyState, DsListRow, DsStack, DsText, formatCount } from '@/ds'

import type { CcTopSchool } from '../../api/command-center-board'
import { ccPaths } from '../command-center/cc-paths'
import { shortSchool } from '../command-center/cc-format'
import { S2_COPY } from './board-copy'
import BoardPanel from './BoardPanel.vue'

const props = defineProps<{ rows: CcTopSchool[] | null; basePath: string }>()
const paths = ccPaths(props.basePath)
</script>

<template>
  <BoardPanel icon="i-ph-trophy" title="Top Sekolah" testid="cc-panel-top-schools">
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
        :key="s.schoolId"
        :rank="i + 1"
        :title="shortSchool(s.schoolName)"
        :title-hint="s.schoolName"
        :to="paths.school(s.schoolId)"
        density="tight"
        data-testid="cc-top-school"
      >
        <template #meta
          ><span data-testid="cc-top-school-count"
            >{{ formatCount(s.activeCount) }} plj</span
          ></template
        >
      </DsListRow>
    </DsStack>
  </BoardPanel>
</template>
