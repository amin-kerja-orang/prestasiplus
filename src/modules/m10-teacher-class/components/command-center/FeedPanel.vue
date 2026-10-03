<script setup lang="ts">
/** "⚡ Live Feed" (FN-M10-2.2.5): the last answers (time, student, subject, ✓/✗); a row opens the student page. */
import type { CcFeedItem } from '../../api/command-center-types'
import BoardPanel from './BoardPanel.vue'
import { useOpenTab } from './composables'
import { S2_COPY, studentPath } from './copy'

defineProps<{ feed: CcFeedItem[] }>()
const openTab = useOpenTab()
</script>

<template>
  <BoardPanel icon="⚡" title="Live Feed" testid="cc-panel-feed">
    <p v-if="feed.length === 0" class="text-sm text-slate-400" data-testid="cc-feed-empty">
      {{ S2_COPY.noActivity }}
    </p>
    <ul v-else class="space-y-1">
      <li
        v-for="(f, i) in feed"
        :key="i"
        class="flex min-w-0 cursor-pointer flex-wrap items-center gap-x-3 gap-y-0.5 rounded-lg px-2 py-2 text-sm hover:bg-slate-700/40"
        data-testid="cc-feed-row"
        @click="openTab(studentPath(f.studentId))"
      >
        <span class="font-mono text-slate-400">{{ f.time }}</span>
        <span class="min-w-0 font-semibold break-words text-slate-50">{{ f.student }}</span>
        <span class="min-w-0 break-words text-slate-400">{{ f.subject }}</span>
        <span :class="f.isCorrect ? 'text-emerald-400' : 'text-rose-400'">{{
          f.isCorrect ? '✓' : '✗'
        }}</span>
      </li>
    </ul>
  </BoardPanel>
</template>
