<script setup lang="ts">
/** "Live Feed" of S3 (FR-M17-43, FN-M17-4.4.3): the period's latest answers - time, name, subject, ✓/✗. */
import type { CcDailyActivity } from '../../api/command-center-board'
import { ccPaths } from '../command-center/cc-paths'
import { S3_COPY } from './board-copy'
import type { LoadStatus } from './composables'
import DailyPanel from './DailyPanel.vue'
import { DsStack, DsText } from '@/ds'

const props = defineProps<{ data: CcDailyActivity | null; status: LoadStatus; basePath: string }>()
const paths = ccPaths(props.basePath)
</script>

<template>
  <DailyPanel title="Live Feed" icon="i-ph-lightning" testid="cc-panel-daily-feed" :state="status">
    <p
      v-if="!data || data.liveFeed.length === 0"
      class="py-6 text-center text-body text-muted"
      data-testid="cc-empty"
    >
      {{ S3_COPY.noActivity }}
    </p>
    <DsStack v-else as="ul" gap="2xs" aria-live="off">
      <li
        v-for="(r, i) in data.liveFeed"
        :key="i"
        class="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 bg-soft px-3 py-2 text-body"
        data-testid="cc-daily-feed-row"
      >
        <DsText variant="caption" as="span" tabular class="shrink-0">{{ r.time }}</DsText>
        <UButton
          :to="paths.student(r.studentId)"
          variant="link"
          color="neutral"
          class="h-auto min-w-0 p-0 text-start"
          :label="r.student"
        />
        <DsText variant="caption" as="span" tone="toned" class="shrink-0">{{ r.subject }}</DsText>
        <span :class="['ms-auto shrink-0', r.correct ? 'text-success' : 'text-error']">{{
          r.correct ? '✓' : '✗'
        }}</span>
      </li>
    </DsStack>
  </DailyPanel>
</template>
