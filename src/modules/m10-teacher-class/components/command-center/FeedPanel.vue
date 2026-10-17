<script setup lang="ts">
/** "Live Feed" (FN-M10-2.2.5): the last answers (time, student, subject, ✓/✗); a row opens the student page. */
import type { CcFeedItem } from '../../api/command-center-types'
import BoardPanel from './BoardPanel.vue'
import { useOpenTab } from './composables'
import { S2_COPY, studentPath } from './copy'

defineProps<{ feed: CcFeedItem[] }>()
const openTab = useOpenTab()
</script>

<template>
  <BoardPanel icon="i-ph-lightning" title="Live Feed" testid="cc-panel-feed">
    <p v-if="feed.length === 0" class="text-body text-muted" data-testid="cc-feed-empty">
      {{ S2_COPY.noActivity }}
    </p>
    <ul v-else class="flex flex-col gap-1" aria-live="off">
      <li v-for="(f, i) in feed" :key="i" class="min-w-0">
        <UButton
          color="neutral"
          variant="ghost"
          block
          class="h-auto min-w-0 flex-wrap justify-start gap-x-3 gap-y-1 px-2 py-2 text-start"
          data-testid="cc-feed-row"
          @click="openTab(studentPath(f.studentId))"
        >
          <span class="tabular text-caption text-muted">{{ f.time }}</span>
          <span class="min-w-0 text-label break-words text-highlighted">{{ f.student }}</span>
          <span class="min-w-0 text-caption break-words text-muted">{{ f.subject }}</span>
          <span :class="f.isCorrect ? 'text-success' : 'text-error'">{{
            f.isCorrect ? '✓' : '✗'
          }}</span>
        </UButton>
      </li>
    </ul>
  </BoardPanel>
</template>
