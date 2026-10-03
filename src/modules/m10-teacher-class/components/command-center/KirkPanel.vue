<script setup lang="ts">
/**
 * "🔬 Kirkpatrick" (FN-M10-2.2.4): T1 "{stars} {v}/10", T2 "{x}% ketepatan", T3 "{n} aktif 30h", T4 "GPS {g}";
 * each row opens its drill (kirk t1-t4). The bar widths are PROPOSED (live shows empty tracks at 0).
 */
import { computed } from 'vue'

import type { CcLiveData } from '../../api/command-center-types'
import BoardPanel from './BoardPanel.vue'
import { type DrillRequest, plain, stars } from './copy'

const props = defineProps<{ d: CcLiveData }>()
const emit = defineEmits<{ drill: [req: DrillRequest] }>()

const clamp = (v: number) => `${String(Math.max(0, Math.min(100, v)))}%`
const rows = computed(() => {
  const d = props.d
  return [
    {
      id: 't1',
      color: 'text-emerald-400',
      bar: 'bg-emerald-500',
      width: clamp(d.kirkT1 * 10),
      text: `${stars(d.kirkT1)} ${plain(d.kirkT1)}/10`,
    },
    {
      id: 't2',
      color: 'text-cyan-400',
      bar: 'bg-cyan-500',
      width: clamp(d.kirkT2Accuracy),
      text: `${String(d.kirkT2Accuracy)}% ketepatan`,
    },
    {
      id: 't3',
      color: 'text-amber-400',
      bar: 'bg-amber-500',
      width: clamp(d.totalStudentsRaw === 0 ? 0 : (d.kirkT3Active / d.totalStudentsRaw) * 100),
      text: `${String(d.kirkT3Active)} aktif 30h`,
    },
    {
      id: 't4',
      color: 'text-rose-400',
      bar: 'bg-rose-500',
      width: clamp(d.kirkT4Gps > 0 ? ((5 - d.kirkT4Gps) / 4) * 100 : 0),
      text: `GPS ${plain(d.kirkT4Gps, 2)}`,
    },
  ]
})
</script>

<template>
  <BoardPanel icon="🔬" title="Kirkpatrick" testid="cc-panel-kirk">
    <ul class="space-y-1">
      <li
        v-for="r in rows"
        :key="r.id"
        class="flex min-h-11 cursor-pointer items-center gap-2"
        :data-testid="`cc-kirk-${r.id}`"
        @click="
          emit('drill', { type: 'kirk', filter: r.id, label: `Kirkpatrick ${r.id.toUpperCase()}` })
        "
      >
        <span :class="['w-7 shrink-0 text-base font-bold', r.color]">{{ r.id.toUpperCase() }}</span>
        <span
          class="h-2 min-w-6 flex-1 overflow-hidden rounded-full bg-slate-900/70"
          aria-hidden="true"
        >
          <span :class="['block h-full rounded-full', r.bar]" :style="{ width: r.width }" />
        </span>
        <span
          class="shrink-0 text-right font-mono text-sm text-slate-300"
          data-testid="cc-kirk-text"
          >{{ r.text }}</span
        >
      </li>
    </ul>
  </BoardPanel>
</template>
