<script setup lang="ts">
/** "Live Feed" (FN-M10-2.2.5): the last answers (time, student, subject, ✓/✗); a row opens the student page. */
import type { CcFeedItem } from '../../api/command-center-types'
import BoardPanel from './BoardPanel.vue'
import { useOpenTab } from './composables'
import { S2_COPY, studentPath } from './copy'
import { DsStack, DsText } from '@/ds'

defineProps<{ feed: CcFeedItem[] }>()
const openTab = useOpenTab()
</script>

<template>
  <BoardPanel icon="lightning" accent="action" title="Live Feed" testid="cc-panel-feed">
    <DsText v-if="feed.length === 0" variant="body" tone="muted" data-testid="cc-feed-empty">
      {{ S2_COPY.noActivity }}
    </DsText>
    <DsStack v-else as="ul" gap="2xs" aria-live="off">
      <li v-for="(f, i) in feed" :key="i" class="min-w-0">
        <UButton
          color="neutral"
          variant="ghost"
          block
          class="h-auto min-w-0 flex-wrap justify-start gap-x-3 gap-y-1 px-2 py-2 text-start"
          data-testid="cc-feed-row"
          @click="openTab(studentPath(f.studentId))"
        >
          <DsText variant="caption" as="span" tabular>{{ f.time }}</DsText>
          <DsText variant="label" tone="highlighted" wrap="anywhere" class="min-w-0">{{
            f.student
          }}</DsText>
          <DsText variant="caption" as="span" wrap="anywhere" class="min-w-0">{{
            f.subject
          }}</DsText>
          <span :class="f.isCorrect ? 'text-success' : 'text-error'">{{
            f.isCorrect ? '✓' : '✗'
          }}</span>
        </UButton>
      </li>
    </DsStack>
  </BoardPanel>
</template>
