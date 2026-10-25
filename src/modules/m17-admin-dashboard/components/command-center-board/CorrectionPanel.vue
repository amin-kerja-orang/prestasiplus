<script setup lang="ts">
/**
 * "Pembetulan" (FR-M17-31, FN-M17-3.3.8): "{n}" Rekod, "+x.x%" Purata Naik, "{n}%" Kadar Baik. No "Top
 * Improvers" list (no list data). The school view shows zeros (FR-M17-111).
 */
import { computed } from 'vue'

import { DsGrid, DsGridItem, DsStatTile } from '@/ds'
import { formatCount, formatNumber } from '@/lib/number'

import type { CcCorrection } from '../../api/command-center-board'
import { S2_COPY } from './board-copy'
import BoardPanel from './BoardPanel.vue'

const props = defineProps<{ correction: CcCorrection | null }>()

const stats = computed(() => {
  const c = props.correction
  if (!c) return []
  const rate = c.total === 0 ? 0 : Math.round((c.improvedCount / c.total) * 100)
  return [
    { id: 'total', value: formatCount(c.total), label: 'Rekod' },
    {
      id: 'avg',
      value: `+${formatNumber(c.avgImprovement, { decimals: 1 })}%`,
      label: 'Purata Naik',
    },
    { id: 'rate', value: `${String(rate)}%`, label: 'Kadar Baik' },
  ]
})
</script>

<template>
  <BoardPanel icon="i-ph-arrows-clockwise" title="Pembetulan" testid="cc-panel-correction">
    <p v-if="!correction" class="text-body text-muted">{{ S2_COPY.loading }}</p>
    <DsGrid v-else as="ul" min-item="xs" gap="sm">
      <DsGridItem v-for="s in stats" :key="s.id" as="li" :data-testid="`cc-correction-${s.id}`">
        <DsStatTile :value="s.value" :unit="s.label" />
      </DsGridItem>
    </DsGrid>
  </BoardPanel>
</template>
