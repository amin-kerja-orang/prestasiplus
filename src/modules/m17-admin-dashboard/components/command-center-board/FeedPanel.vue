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
    <ul v-else class="flex flex-1 flex-col" aria-live="off">
      <li
        v-for="(r, i) in rows"
        :key="i"
        class="flex min-h-14 flex-1 flex-wrap items-center gap-x-2 gap-y-1 px-2 py-2 hover:bg-soft md:grid md:grid-cols-12 md:flex-nowrap md:gap-x-3 md:px-3"
        data-testid="cc-feed-row"
      >
        <UBadge
          role="img"
          :aria-label="r.correct ? 'Betul' : 'Salah'"
          :color="r.correct ? 'success' : 'error'"
          variant="soft"
          class="order-1 size-6 shrink-0 justify-center p-0 md:order-none md:col-span-1 md:size-7 md:justify-self-start"
          data-testid="cc-feed-mark"
          >{{ r.correct ? '✓' : '✗' }}</UBadge
        >
        <span
          class="order-2 min-w-0 flex-1 truncate text-label text-highlighted md:order-none md:col-span-4"
          data-testid="cc-feed-name"
          >{{ r.student }}</span
        >
        <span class="order-3 shrink-0 md:order-none md:col-span-2 md:min-w-0 md:justify-self-start">
          <UBadge color="neutral" variant="soft" size="sm" data-testid="cc-feed-subject">{{
            r.subject
          }}</UBadge>
        </span>
        <span
          class="tabular order-4 w-12 shrink-0 text-end text-caption text-muted md:order-none md:col-span-1 md:col-start-12 md:row-start-1 md:w-auto"
          data-testid="cc-feed-time"
          >{{ r.time }}</span
        >
        <ULink
          v-if="r.schoolId !== null && r.schoolName"
          :to="paths.school(r.schoolId)"
          :title="r.schoolName"
          class="order-5 min-w-0 basis-full truncate ps-8 text-caption text-muted md:order-none md:col-span-4 md:basis-auto md:ps-0"
          data-testid="cc-feed-school"
          >{{ shortSchool(r.schoolName) }}</ULink
        >
      </li>
    </ul>
  </BoardPanel>
</template>
