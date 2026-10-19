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
import { DsStack, DsText } from '@/ds'

const props = defineProps<{ rows: CcFeedRow[] | null; basePath: string }>()
const paths = ccPaths(props.basePath)
</script>

<template>
  <BoardPanel icon="i-ph-lightning" title="Live Feed" testid="cc-panel-feed">
    <DsText v-if="rows === null" variant="body" tone="muted">{{ S2_COPY.loading }}</DsText>
    <DsText v-else-if="rows.length === 0" variant="body" tone="muted" data-testid="cc-empty">
      {{ S2_COPY.noFeed }}
    </DsText>
    <DsStack v-else as="ul" gap="2xs" aria-live="off">
      <li
        v-for="(r, i) in rows"
        :key="i"
        class="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 bg-soft px-3 py-2 text-body"
        data-testid="cc-feed-row"
      >
        <DsText variant="caption" as="span" tabular class="shrink-0" data-testid="cc-feed-time">{{
          r.time
        }}</DsText>
        <DsText
          variant="label"
          tone="highlighted"
          wrap="anywhere"
          class="min-w-0"
          data-testid="cc-feed-name"
          >{{ r.student }}</DsText
        >
        <DsText
          variant="caption"
          as="span"
          tone="toned"
          class="shrink-0"
          data-testid="cc-feed-subject"
          >{{ r.subject }}</DsText
        >
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
    </DsStack>
  </BoardPanel>
</template>
