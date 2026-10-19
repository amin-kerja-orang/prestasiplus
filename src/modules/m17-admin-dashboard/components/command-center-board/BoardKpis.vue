<script setup lang="ts">
/**
 * The four big counters of S2 (FR-M17-23, FN-M17-3.2.1-3.2.4): "Sekolah Berdaftar", "Pelajar Berdaftar",
 * "Soalan Dijawab" (animated over 800 ms) and "Ketepatan Purata". The school view reads "sekolah anda"
 * under the accuracy and never "keseluruhan platform" (FR-M17-106 b).
 */
import { computed } from 'vue'

import { DsIconChip } from '@/ds'
import { formatCount, formatNumber } from '@/lib/number'

import type { CcLiveData } from '../../api/command-center-board'
import { accentAt } from '../command-center/cc-format'
import { S2_COPY } from './board-copy'
import { useCountUp } from './composables'

const props = defineProps<{ data: CcLiveData | null; school: boolean }>()

const schools = useCountUp(computed(() => props.data?.totalSchools ?? null))
const students = useCountUp(computed(() => props.data?.totalStudents ?? null))
const answered = useCountUp(computed(() => props.data?.totalAnswered ?? null))

const accuracy = computed(() =>
  props.data ? `${formatNumber(props.data.accuracy, { decimals: 1 })}%` : S2_COPY.placeholder,
)
const active = computed(() => (props.data ? formatCount(props.data.activeStudents) : '--'))

const tiles = computed<{ id: string; label: string; value: string; sub: string; icon: string }[]>(
  () => [
    {
      id: 'schools',
      label: 'Sekolah Berdaftar',
      value: schools.value,
      sub: 'langganan aktif',
      icon: 'i-ph-buildings',
    },
    {
      id: 'students',
      label: 'Pelajar Berdaftar',
      value: students.value,
      sub: `${active.value} aktif menjawab`,
      icon: 'i-ph-student',
    },
    {
      id: 'answered',
      label: 'Soalan Dijawab',
      value: answered.value,
      sub: 'sepanjang masa',
      icon: 'i-ph-clipboard-text',
    },
    {
      id: 'accuracy',
      label: 'Ketepatan Purata',
      value: accuracy.value,
      sub: props.school ? 'sekolah anda' : 'keseluruhan platform',
      icon: 'i-ph-target',
    },
  ],
)
</script>

<template>
  <div class="grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="cc-kpis" aria-live="off">
    <UCard v-for="(t, i) in tiles" :key="t.id" class="min-w-0" :data-testid="`cc-kpi-${t.id}`">
      <div class="flex min-w-0 flex-col items-start gap-1">
        <span class="flex w-full min-w-0 items-center gap-2">
          <DsIconChip :icon="t.icon" :accent="accentAt(i)" size="sm" />
          <span class="min-w-0 text-overline text-muted">{{ t.label }}</span>
        </span>
        <span class="tabular text-title break-words text-highlighted" data-testid="cc-kpi-value">{{
          t.value
        }}</span>
        <span class="text-caption text-muted" data-testid="cc-kpi-sub">{{ t.sub }}</span>
      </div>
    </UCard>
  </div>
</template>
