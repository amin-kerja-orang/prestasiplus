<script setup lang="ts">
/** "💚 Mood Pelajar" (FR-M17-30, FN-M17-3.3.7): 😊 Gembira, 😐 OK, 😢 Sedih, 😩 Tekanan with all-time counts. */
import { formatCount } from '@/lib/number'

import type { CcMoodCounts } from '../../api/command-center-board'
import { MOODS, S2_COPY } from './board-copy'
import BoardPanel from './BoardPanel.vue'

defineProps<{ mood: CcMoodCounts | null }>()
</script>

<template>
  <BoardPanel icon="💚" title="Mood Pelajar" testid="cc-panel-mood" fixed>
    <p v-if="mood === null" class="text-sm text-slate-400">{{ S2_COPY.loading }}</p>
    <ul v-else class="flex flex-wrap gap-x-5 gap-y-2 xl:gap-x-3 xl:gap-y-0">
      <li
        v-for="m in MOODS"
        :key="m.key"
        class="flex min-h-7 items-center gap-2 text-sm text-slate-300 xl:gap-1.5"
        :data-testid="`cc-mood-${m.key}`"
      >
        <span class="text-xl xl:text-lg">{{ m.emoji }}</span>
        <span>{{ m.label }}</span>
        <span class="font-mono text-slate-100" data-testid="cc-mood-count">{{
          formatCount(mood[m.key])
        }}</span>
      </li>
    </ul>
  </BoardPanel>
</template>
