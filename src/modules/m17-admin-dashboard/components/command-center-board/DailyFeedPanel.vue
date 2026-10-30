<script setup lang="ts">
/** "Live Feed" of S3 (FR-M17-43, FN-M17-4.4.3): the period's latest answers - time, name, subject, ✓/✗. */
import { DsBadge, DsEmptyState, DsListRow, DsStack } from '@/ds'

import type { CcDailyActivity } from '../../api/command-center-board'
import { ccPaths } from '../command-center/cc-paths'
import { S3_COPY } from './board-copy'
import type { LoadStatus } from './composables'
import DailyPanel from './DailyPanel.vue'

const props = defineProps<{ data: CcDailyActivity | null; status: LoadStatus; basePath: string }>()
const paths = ccPaths(props.basePath)
</script>

<template>
  <DailyPanel title="Live Feed" icon="i-ph-lightning" testid="cc-panel-daily-feed" :state="status">
    <DsEmptyState
      v-if="!data || data.liveFeed.length === 0"
      size="sm"
      :title="S3_COPY.noActivity"
      data-testid="cc-empty"
    />
    <DsStack v-else as="ul" gap="xs" aria-live="off">
      <DsListRow
        v-for="(r, i) in data.liveFeed"
        :key="i"
        :title="r.student"
        :sub="r.subject"
        :to="paths.student(r.studentId)"
        density="tight"
        data-testid="cc-daily-feed-row"
      >
        <template #leading
          ><span class="tabular shrink-0 text-caption text-muted">{{ r.time }}</span></template
        >
        <template #meta
          ><DsBadge
            :tone="r.correct ? 'success' : 'error'"
            :label="r.correct ? '✓' : '✗'"
            size="sm"
        /></template>
      </DsListRow>
    </DsStack>
  </DailyPanel>
</template>
