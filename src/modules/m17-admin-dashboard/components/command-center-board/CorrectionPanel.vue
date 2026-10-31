<script setup lang="ts">
/**
 * "Pembetulan" (FR-M17-31, FN-M17-3.3.8): "{n}" Rekod, "+x.x%" Purata Naik, "{n}%" Kadar Baik. No "Top
 * Improvers" list (no list data). The school view shows zeros (FR-M17-111).
 */
import { computed } from 'vue'

import { DsIconChip, DsListRow, DsStack, DsText, type DsAccent } from '@/ds'
import { formatCount, formatNumber } from '@/lib/number'

import type { CcCorrection } from '../../api/command-center-board'
import { S2_COPY } from './board-copy'
import BoardPanel from './BoardPanel.vue'

const props = defineProps<{ correction: CcCorrection | null }>()

const stats = computed<
  { id: string; value: string; label: string; icon: string; accent: DsAccent }[]
>(() => {
  const c = props.correction
  if (!c) return []
  const rate = c.total === 0 ? 0 : Math.round((c.improvedCount / c.total) * 100)
  return [
    {
      id: 'total',
      value: formatCount(c.total),
      label: 'Rekod',
      icon: 'notebook',
      accent: 'action',
    },
    {
      id: 'avg',
      value: `+${formatNumber(c.avgImprovement, { decimals: 1 })}%`,
      label: 'Purata Naik',
      icon: 'trend-up',
      accent: 'win',
    },
    {
      id: 'rate',
      value: `${String(rate)}%`,
      label: 'Kadar Baik',
      icon: 'check-circle',
      accent: 'friend',
    },
  ]
})
</script>

<template>
  <BoardPanel icon="i-ph-arrows-clockwise" title="Pembetulan" testid="cc-panel-correction">
    <DsText v-if="!correction" variant="body" tone="muted">{{ S2_COPY.loading }}</DsText>
    <DsStack v-else as="ul" gap="xs">
      <DsListRow
        v-for="s in stats"
        :key="s.id"
        :title="s.label"
        density="tight"
        :data-testid="`cc-correction-${s.id}`"
      >
        <template #leading><DsIconChip :icon="s.icon" :accent="s.accent" size="sm" /></template>
        <template #meta>{{ s.value }}</template>
      </DsListRow>
    </DsStack>
  </BoardPanel>
</template>
