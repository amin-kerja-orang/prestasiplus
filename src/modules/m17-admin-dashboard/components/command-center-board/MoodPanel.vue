<script setup lang="ts">
/** "Mood Pelajar" (FR-M17-30, FN-M17-3.3.7): Gembira, OK, Sedih, Tekanan with all-time counts. */
import { DsIconChip, DsListRow, DsStack, DsText, formatCount } from '@/ds'

import type { CcMoodCounts } from '../../api/command-center-board'
import { MOODS, S2_COPY } from './board-copy'
import BoardPanel from './BoardPanel.vue'

defineProps<{ mood: CcMoodCounts | null }>()
</script>

<template>
  <BoardPanel icon="i-ph-smiley" title="Mood Pelajar" testid="cc-panel-mood">
    <DsText v-if="mood === null" variant="body" tone="muted">{{ S2_COPY.loading }}</DsText>
    <DsStack v-else as="ul" gap="xs">
      <DsListRow
        v-for="m in MOODS"
        :key="m.key"
        :title="m.label"
        density="tight"
        :data-testid="`cc-mood-${m.key}`"
      >
        <template #leading
          ><DsIconChip :icon="m.icon.replace('i-ph-', '')" :accent="m.accent" size="sm"
        /></template>
        <template #meta
          ><span data-testid="cc-mood-count">{{ formatCount(mood[m.key]) }}</span></template
        >
      </DsListRow>
    </DsStack>
  </BoardPanel>
</template>
