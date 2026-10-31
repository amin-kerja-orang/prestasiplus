<script setup lang="ts">
/**
 * "Live Feed" (FR-M17-28, FN-M17-3.3.5): the 10 latest answers - time, pupil, subject, school (cut to 15
 * characters, link to S4, full name in `title`), "✓" / "✗". Names are text, never HTML (DV-M17-26).
 */
import { DsBadge, DsEmptyState, DsListRow, DsStack, DsText } from '@/ds'

import type { CcFeedRow } from '../../api/command-center-board'
import { ccPaths } from '../command-center/cc-paths'
import { shortSchool } from '../command-center/cc-format'
import { S2_COPY } from './board-copy'
import BoardPanel from './BoardPanel.vue'

const props = defineProps<{ rows: CcFeedRow[] | null; basePath: string }>()
const paths = ccPaths(props.basePath)
</script>

<template>
  <BoardPanel icon="i-ph-lightning" title="Live Feed" testid="cc-panel-feed">
    <DsText v-if="rows === null" variant="body" tone="muted">{{ S2_COPY.loading }}</DsText>
    <DsEmptyState
      v-else-if="rows.length === 0"
      size="sm"
      :title="S2_COPY.noFeed"
      data-testid="cc-empty"
    />
    <DsStack v-else as="ul" gap="xs" aria-live="off">
      <DsListRow
        v-for="(r, i) in rows"
        :key="i"
        :title="r.student"
        density="tight"
        data-testid="cc-feed-row"
      >
        <template #leading
          ><span class="tabular shrink-0 text-caption text-muted" data-testid="cc-feed-time">{{
            r.time
          }}</span></template
        >
        <template #meta
          ><span class="flex flex-wrap items-center justify-end gap-x-3 gap-y-1"
            ><span class="text-caption text-toned" data-testid="cc-feed-subject">{{
              r.subject
            }}</span
            ><UButton
              v-if="r.schoolId !== null && r.schoolName"
              :to="paths.school(r.schoolId)"
              :title="r.schoolName"
              variant="link"
              color="neutral"
              size="xs"
              class="h-auto min-w-0 p-0 text-caption"
              :label="shortSchool(r.schoolName)"
              data-testid="cc-feed-school" /><DsBadge
              :tone="r.correct ? 'success' : 'error'"
              :label="r.correct ? '✓' : '✗'"
              size="sm"
              data-testid="cc-feed-mark"
          /></span>
        </template>
      </DsListRow>
    </DsStack>
  </BoardPanel>
</template>
