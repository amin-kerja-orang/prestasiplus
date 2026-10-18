<script setup lang="ts">
/**
 * "Live Feed" (FR-M17-28, FN-M17-3.3.5): the 10 latest answers - time, pupil, subject, school (cut to 15
 * characters, link to S4, full name in `title`), "✓" / "✗". Names are text, never HTML (DV-M17-26).
 */
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
    <p v-if="rows === null" class="text-body text-muted">{{ S2_COPY.loading }}</p>
    <p v-else-if="rows.length === 0" class="text-body text-muted" data-testid="cc-empty">
      {{ S2_COPY.noFeed }}
    </p>
    <ul v-else class="flex flex-col gap-1" aria-live="off">
      <li
        v-for="(r, i) in rows"
        :key="i"
        class="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 bg-soft px-3 py-2 text-body"
        data-testid="cc-feed-row"
      >
        <span class="tabular shrink-0 text-caption text-muted" data-testid="cc-feed-time">{{
          r.time
        }}</span>
        <span class="min-w-0 text-label break-words text-highlighted" data-testid="cc-feed-name">{{
          r.student
        }}</span>
        <span class="shrink-0 text-caption text-toned" data-testid="cc-feed-subject">{{
          r.subject
        }}</span>
        <UButton
          v-if="r.schoolId !== null && r.schoolName"
          :to="paths.school(r.schoolId)"
          :title="r.schoolName"
          variant="link"
          color="neutral"
          size="sm"
          class="h-auto min-w-0 p-0"
          :label="shortSchool(r.schoolName)"
          data-testid="cc-feed-school"
        />
        <span
          :class="['ms-auto shrink-0', r.correct ? 'text-success' : 'text-error']"
          data-testid="cc-feed-mark"
          >{{ r.correct ? '✓' : '✗' }}</span
        >
      </li>
    </ul>
  </BoardPanel>
</template>
