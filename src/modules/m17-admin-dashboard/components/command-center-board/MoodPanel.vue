<script setup lang="ts">
/** "Mood Pelajar" (FR-M17-30, FN-M17-3.3.7): Gembira, OK, Sedih, Tekanan with all-time counts. */
import { formatCount } from '@/lib/number'

import type { CcMoodCounts } from '../../api/command-center-board'
import { MOODS, S2_COPY } from './board-copy'
import BoardPanel from './BoardPanel.vue'
import { DsGrid, DsText } from '@/ds'

defineProps<{ mood: CcMoodCounts | null }>()
</script>

<template>
  <BoardPanel icon="i-ph-smiley" title="Mood Pelajar" testid="cc-panel-mood">
    <DsText v-if="mood === null" variant="body" tone="muted">{{ S2_COPY.loading }}</DsText>
    <DsGrid v-else :cols="2" gap="xs" as="ul">
      <li
        v-for="m in MOODS"
        :key="m.key"
        class="flex min-h-11 min-w-0 items-center gap-2 bg-soft px-3 text-body text-toned"
        :data-testid="`cc-mood-${m.key}`"
      >
        <UIcon :name="m.icon" class="size-5 shrink-0" aria-hidden="true" />
        <span>{{ m.label }}</span>
        <DsText
          variant="label"
          tone="highlighted"
          tabular
          class="ms-auto"
          data-testid="cc-mood-count"
          >{{ formatCount(mood[m.key]) }}</DsText
        >
      </li>
    </DsGrid>
  </BoardPanel>
</template>
