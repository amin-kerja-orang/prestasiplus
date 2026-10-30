<script setup lang="ts">
/**
 * The four big counters of S2 (FR-M17-23, FN-M17-3.2.1-3.2.4): "Sekolah Berdaftar", "Pelajar Berdaftar",
 * "Soalan Dijawab" (animated over 800 ms) and "Ketepatan Purata". The school view reads "sekolah anda"
 * under the accuracy and never "keseluruhan platform" (FR-M17-106 b).
 */
import { computed } from 'vue'

import { DsGrid, DsGridItem, DsStatTile, formatCount, formatPercent } from '@/ds'

import type { CcLiveData } from '../../api/command-center-board'
import { accentAt } from '../command-center/cc-format'
import { S2_COPY } from './board-copy'
import { useCountUp } from './composables'

const props = defineProps<{ data: CcLiveData | null; school: boolean }>()

const schools = useCountUp(computed(() => props.data?.totalSchools ?? null))
const students = useCountUp(computed(() => props.data?.totalStudents ?? null))
const answered = useCountUp(computed(() => props.data?.totalAnswered ?? null))

const accuracy = computed(() =>
  props.data ? formatPercent(props.data.accuracy) : S2_COPY.placeholder,
)
const active = computed(() => (props.data ? formatCount(props.data.activeStudents) : '--'))

const tiles = computed<{ id: string; label: string; value: string; sub: string; icon: string }[]>(
  () => [
    {
      id: 'schools',
      label: 'Sekolah Berdaftar',
      value: schools.value,
      sub: 'langganan aktif',
      icon: 'buildings',
    },
    {
      id: 'students',
      label: 'Pelajar Berdaftar',
      value: students.value,
      sub: `${active.value} aktif menjawab`,
      icon: 'student',
    },
    {
      id: 'answered',
      label: 'Soalan Dijawab',
      value: answered.value,
      sub: 'sepanjang masa',
      icon: 'clipboard-text',
    },
    {
      id: 'accuracy',
      label: 'Ketepatan Purata',
      value: accuracy.value,
      sub: props.school ? 'sekolah anda' : 'keseluruhan platform',
      icon: 'target',
    },
  ],
)
</script>

<template>
  <DsGrid :cols="{ base: 2, md: 4 }" gap="md" data-testid="cc-kpis" aria-live="off">
    <DsGridItem v-for="(t, i) in tiles" :key="t.id" :data-testid="`cc-kpi-${t.id}`">
      <DsStatTile
        :value="t.value"
        :unit="t.label"
        :sub="t.sub"
        :icon="t.icon"
        :accent="accentAt(i)"
        part-prefix="cc-kpi"
      />
    </DsGridItem>
  </DsGrid>
</template>
