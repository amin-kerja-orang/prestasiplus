<script setup lang="ts">
/**
 * The four big counters of S2 (FR-M17-23, FN-M17-3.2.1-3.2.4): "Sekolah Berdaftar", "Pelajar Berdaftar",
 * "Soalan Dijawab" (animated over 800 ms) and "Ketepatan Purata". The school view reads "sekolah anda"
 * under the accuracy and never "keseluruhan platform" (FR-M17-106 b).
 */
import { computed } from 'vue'

import { formatCount, formatNumber } from '@/lib/number'

import type { CcLiveData } from '../../api/command-center-board'
import { ACCENT_EDGE, ACCENT_TEXT, S2_COPY, type BoardAccent } from './board-copy'
import { useCountUp } from './composables'

const props = defineProps<{ data: CcLiveData | null; school: boolean }>()

const schools = useCountUp(computed(() => props.data?.totalSchools ?? null))
const students = useCountUp(computed(() => props.data?.totalStudents ?? null))
const answered = useCountUp(computed(() => props.data?.totalAnswered ?? null))

const accuracy = computed(() =>
  props.data ? `${formatNumber(props.data.accuracy, { decimals: 1 })}%` : S2_COPY.placeholder,
)
const active = computed(() => (props.data ? formatCount(props.data.activeStudents) : '--'))

const tiles = computed<
  { id: string; label: string; value: string; sub: string; accent: BoardAccent }[]
>(() => [
  {
    id: 'schools',
    label: 'Sekolah Berdaftar',
    value: schools.value,
    sub: 'langganan aktif',
    accent: 'indigo',
  },
  {
    id: 'students',
    label: 'Pelajar Berdaftar',
    value: students.value,
    sub: `${active.value} aktif menjawab`,
    accent: 'emerald',
  },
  {
    id: 'answered',
    label: 'Soalan Dijawab',
    value: answered.value,
    sub: 'sepanjang masa',
    accent: 'amber',
  },
  {
    id: 'accuracy',
    label: 'Ketepatan Purata',
    value: accuracy.value,
    sub: props.school ? 'sekolah anda' : 'keseluruhan platform',
    accent: 'rose',
  },
])
</script>

<template>
  <div
    class="grid grid-cols-2 gap-3 md:grid-cols-4 xl:shrink-0 xl:grid-cols-[1.9fr_1fr_1fr_1.2fr]"
    data-testid="cc-kpis"
  >
    <div
      v-for="t in tiles"
      :key="t.id"
      :class="[
        'min-w-0 rounded-2xl border border-t-4 border-slate-700 bg-slate-800 p-4 xl:p-2.5',
        ACCENT_EDGE[t.accent],
      ]"
      :data-testid="`cc-kpi-${t.id}`"
    >
      <div class="text-xs font-semibold tracking-widest text-slate-400 uppercase">
        {{ t.label }}
      </div>
      <div
        :class="['mt-1 font-mono text-3xl font-bold break-words', ACCENT_TEXT[t.accent]]"
        data-testid="cc-kpi-value"
      >
        {{ t.value }}
      </div>
      <div class="mt-1 text-sm text-slate-400" data-testid="cc-kpi-sub">{{ t.sub }}</div>
    </div>
  </div>
</template>
