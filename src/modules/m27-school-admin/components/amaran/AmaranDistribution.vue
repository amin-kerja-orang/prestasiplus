<script setup lang="ts">
/**
 * S4 card "Taburan Risiko Seluruh Sekolah" (FR-M27-75, 79): a stacked bar (Hijau, Kuning, Merah) with the integer
 * percent in each segment, and the legend "Hijau: {n}", "Kuning: {n}", "Merah: {n}". Without pupils the bar has no
 * segments (FR-M27-79).
 */
import { computed } from 'vue'

import { formatCount } from '@/lib/number'

import type { RiskTallyView } from '../../api/amaran'

const props = defineProps<{ tally: RiskTallyView }>()

const segments = computed(() => [
  {
    key: 'green',
    label: 'Hijau',
    count: props.tally.green,
    pct: props.tally.pct.green,
    color: 'bg-emerald-500',
  },
  {
    key: 'yellow',
    label: 'Kuning',
    count: props.tally.yellow,
    pct: props.tally.pct.yellow,
    color: 'bg-amber-500',
  },
  {
    key: 'red',
    label: 'Merah',
    count: props.tally.red,
    pct: props.tally.pct.red,
    color: 'bg-red-500',
  },
])
const visible = computed(() => segments.value.filter((s) => s.count > 0))
</script>

<template>
  <section
    class="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
    data-testid="am-distribution"
  >
    <h2 class="text-base font-bold text-slate-800">Taburan Risiko Seluruh Sekolah</h2>
    <div
      class="mt-3 flex h-8 w-full min-w-0 overflow-hidden rounded-full bg-slate-100"
      data-testid="am-bar"
    >
      <div
        v-for="s in visible"
        :key="s.key"
        :class="[
          'flex min-w-0 items-center justify-center overflow-hidden text-xs font-bold text-white',
          s.color,
        ]"
        :style="{ flexGrow: s.count, flexBasis: 0 }"
        :data-testid="`am-seg-${s.key}`"
      >
        {{ s.pct }}%
      </div>
    </div>
    <ul class="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-700" data-testid="am-legend">
      <li
        v-for="s in segments"
        :key="s.key"
        class="inline-flex items-center gap-2"
        :data-testid="`am-legend-${s.key}`"
      >
        <span :class="['h-3 w-3 rounded-full', s.color]" />
        {{ s.label }}: {{ formatCount(s.count) }}
      </li>
    </ul>
  </section>
</template>
