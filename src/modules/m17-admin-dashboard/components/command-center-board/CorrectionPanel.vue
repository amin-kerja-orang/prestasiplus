<script setup lang="ts">
/**
 * "🔄 Pembetulan" (FR-M17-31, FN-M17-3.3.8): "{n}" Rekod, "+x.x%" Purata Naik, "{n}%" Kadar Baik. No "Top
 * Improvers" list (no list data). The school view shows zeros (FR-M17-111).
 */
import { computed } from 'vue'

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
    { id: 'total', value: formatCount(c.total), label: 'Rekod', tone: 'text-cyan-400' },
    {
      id: 'avg',
      value: `+${formatNumber(c.avgImprovement, { decimals: 1 })}%`,
      label: 'Purata Naik',
      tone: 'text-emerald-400',
    },
    { id: 'rate', value: `${String(rate)}%`, label: 'Kadar Baik', tone: 'text-amber-400' },
  ]
})
</script>

<template>
  <BoardPanel icon="🔄" title="Pembetulan" testid="cc-panel-correction">
    <p v-if="!correction" class="text-sm text-slate-400">{{ S2_COPY.loading }}</p>
    <ul v-else class="flex flex-wrap gap-x-6 gap-y-2">
      <li v-for="s in stats" :key="s.id" class="text-center" :data-testid="`cc-correction-${s.id}`">
        <div :class="['font-mono text-2xl font-bold', s.tone]" data-testid="cc-correction-value">
          {{ s.value }}
        </div>
        <div class="text-xs tracking-wider text-slate-400 uppercase">{{ s.label }}</div>
      </li>
    </ul>
  </BoardPanel>
</template>
