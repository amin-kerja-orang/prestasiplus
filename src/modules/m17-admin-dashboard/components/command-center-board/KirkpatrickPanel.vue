<script setup lang="ts">
/**
 * "🔬 Kirkpatrick" (FR-M17-25, FN-M17-3.3.2, BR-M17-08): T1 stars + "{v}/5", T2 "{acc}% ketepatan",
 * T3 "{n} aktif 30h", T4 "GPS {gps}" with their bars.
 */
import { computed } from 'vue'

import { formatCount, formatNumber } from '@/lib/number'

import { ccKirkpatrickBars, ccStars, type CcLiveData } from '../../api/command-center-board'
import { S2_COPY } from './board-copy'
import BoardPanel from './BoardPanel.vue'

const props = defineProps<{ data: CcLiveData | null }>()

const rows = computed(() => {
  const d = props.data
  if (!d) return []
  const bars = ccKirkpatrickBars(d)
  return [
    {
      id: 't1',
      label: 'T1',
      tone: 'text-emerald-400',
      bar: 'bg-emerald-500',
      width: bars.t1,
      text: `${ccStars(d.kirk.t1.value)} ${formatNumber(d.kirk.t1.value, { decimals: 1 })}/${String(d.kirk.t1.scale)}`,
    },
    {
      id: 't2',
      label: 'T2',
      tone: 'text-cyan-400',
      bar: 'bg-cyan-500',
      width: bars.t2,
      text: `${formatNumber(d.kirk.t2Accuracy, { decimals: 1 })}% ketepatan`,
    },
    {
      id: 't3',
      label: 'T3',
      tone: 'text-amber-400',
      bar: 'bg-amber-500',
      width: bars.t3,
      text: `${formatCount(d.kirk.t3Active)} aktif 30h`,
    },
    {
      id: 't4',
      label: 'T4',
      tone: 'text-violet-400',
      bar: 'bg-violet-500',
      width: bars.t4,
      text: `GPS ${formatNumber(d.kirk.t4Gps, { decimals: 3, grouping: false })}`,
    },
  ]
})
</script>

<template>
  <BoardPanel icon="🔬" title="Kirkpatrick" testid="cc-panel-kirkpatrick">
    <p v-if="!data" class="text-sm text-slate-400">{{ S2_COPY.loading }}</p>
    <ul v-else class="space-y-3">
      <li
        v-for="r in rows"
        :key="r.id"
        class="grid grid-cols-[2rem_minmax(0,1fr)] items-center gap-x-3 gap-y-1 sm:grid-cols-[2rem_minmax(0,1fr)_auto]"
        :data-testid="`cc-kirk-${r.id}`"
      >
        <span :class="['font-mono text-base font-bold', r.tone]">{{ r.label }}</span>
        <span class="h-2.5 overflow-hidden rounded-full bg-slate-900/70">
          <span
            :class="['block h-full rounded-full', r.bar]"
            :style="{ width: `${String(r.width * 100)}%` }"
            data-testid="cc-kirk-bar"
          />
        </span>
        <span
          class="col-span-2 text-right font-mono text-sm text-slate-300 sm:col-span-1"
          data-testid="cc-kirk-text"
          >{{ r.text }}</span
        >
      </li>
    </ul>
  </BoardPanel>
</template>
