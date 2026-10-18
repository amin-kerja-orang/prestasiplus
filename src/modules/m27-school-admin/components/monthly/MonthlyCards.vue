<script setup lang="ts">
/**
 * S4 four summary cards (restyle spec AS-50): Penglibatan, Soalan Dijawab, Ketepatan, Sesi Latihan as stat
 * tiles. 2 per row below `lg`, 4 from `lg`.
 */
import { computed } from 'vue'

import type { MonthlyReport } from '../../api/school-admin'
import { DsStatRow, type StatItem } from '@/ds'
import { count, pct0, pct1 } from './monthly-format'

const props = defineProps<{ cards: MonthlyReport['cards'] }>()

const items = computed<StatItem[]>(() => [
  {
    key: 'participation',
    label: 'Penglibatan',
    value: pct0(props.cards.participationPct),
    sub: `${count(props.cards.active)} aktif / ${count(props.cards.registered)} daftar`,
    icon: 'users-three',
    accent: 'action',
  },
  {
    key: 'answers',
    label: 'Soalan Dijawab',
    value: count(props.cards.answers),
    sub: `${count(props.cards.perPupil)} soalan/pelajar`,
    icon: 'check-circle',
    accent: 'win',
  },
  { key: 'accuracy', label: 'Ketepatan', value: pct1(props.cards.accuracy), icon: 'target', accent: 'heat' },
  {
    key: 'sessions',
    label: 'Sesi Latihan',
    value: count(props.cards.sessions),
    icon: 'clipboard-text',
    accent: 'trial',
  },
])
</script>

<template>
  <DsStatRow :items="items" prefix="lb-card" part-prefix="lb-card" data-testid="lb-cards" :cols="4" />
</template>
