<script setup lang="ts">
/**
 * S4 four summary cards (restyle spec AS-50): Penglibatan, Soalan Dijawab, Ketepatan, Sesi Latihan as stat
 * tiles. 2 per row below `lg`, 4 from `lg`.
 */
import { computed } from 'vue'

import type { MonthlyReport } from '../../api/school-admin'
import StatRow, { type StatItem } from '../shared/StatRow.vue'
import { count, pct0, pct1 } from './monthly-format'

const props = defineProps<{ cards: MonthlyReport['cards'] }>()

const items = computed<StatItem[]>(() => [
  {
    key: 'participation',
    label: 'Penglibatan',
    value: pct0(props.cards.participationPct),
    sub: `${count(props.cards.active)} aktif / ${count(props.cards.registered)} daftar`,
    icon: 'i-ph-users-three',
  },
  {
    key: 'answers',
    label: 'Soalan Dijawab',
    value: count(props.cards.answers),
    sub: `${count(props.cards.perPupil)} soalan/pelajar`,
    icon: 'i-ph-check-circle',
  },
  { key: 'accuracy', label: 'Ketepatan', value: pct1(props.cards.accuracy), icon: 'i-ph-target' },
  {
    key: 'sessions',
    label: 'Sesi Latihan',
    value: count(props.cards.sessions),
    icon: 'i-ph-clipboard-text',
  },
])
</script>

<template>
  <StatRow :items="items" prefix="lb-card" nav-id="lb-cards" />
</template>
