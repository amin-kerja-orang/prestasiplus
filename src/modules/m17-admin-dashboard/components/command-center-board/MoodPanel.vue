<script setup lang="ts">
/** "Mood Pelajar" (FR-M17-30, FN-M17-3.3.7): Gembira, OK, Sedih, Tekanan with all-time counts. */
import { formatCount } from '@/lib/number'

import type { CcMoodCounts } from '../../api/command-center-board'
import { MOODS, S2_COPY } from './board-copy'
import BoardPanel from './BoardPanel.vue'

defineProps<{ mood: CcMoodCounts | null }>()
</script>

<template>
  <BoardPanel icon="i-ph-smiley" title="Mood Pelajar" testid="cc-panel-mood">
    <p v-if="mood === null" class="text-body text-muted">{{ S2_COPY.loading }}</p>
    <ul v-else class="grid grid-cols-2 gap-2">
      <li
        v-for="m in MOODS"
        :key="m.key"
        class="flex min-h-11 min-w-0 items-center gap-2 bg-soft px-3 text-body text-toned"
        :data-testid="`cc-mood-${m.key}`"
      >
        <UIcon :name="m.icon" class="size-5 shrink-0" aria-hidden="true" />
        <span>{{ m.label }}</span>
        <span class="tabular ms-auto text-label text-highlighted" data-testid="cc-mood-count">{{
          formatCount(mood[m.key])
        }}</span>
      </li>
    </ul>
  </BoardPanel>
</template>
