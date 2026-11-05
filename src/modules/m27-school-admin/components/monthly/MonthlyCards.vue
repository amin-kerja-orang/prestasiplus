<script setup lang="ts">
/**
 * S4 summary cards (R1-AS-50, restyle spec AS-50) as stat tiles: Pelajar Berdaftar ("{n} aktif"), Kadar
 * Penglibatan ("daripada pelajar daftar"), Soalan Dijawab ("sepanjang {bulan}"), Ketepatan ("purata jawapan
 * betul"), Guru ("berdaftar"), Soalan / Pelajar Aktif ("purata kedalaman penggunaan"), Bulan Paling Aktif
 * ("{n} sesi") and Sesi Latihan. A month without data shows the dash for Ketepatan and Bulan Paling Aktif.
 * 2 per row below `lg`, 4 from `lg`.
 */
import { computed } from 'vue'

import type { MonthlyReport } from '../../api/school-admin'
import { DsStatRow, type StatItem } from '@/ds'
import { count, monthNameOf, NO_DATA, pct0, pctWhole } from './monthly-format'

const props = defineProps<{ cards: MonthlyReport['cards']; label: string }>()

const items = computed<StatItem[]>(() => [
  {
    key: 'registered',
    label: 'Pelajar Berdaftar',
    value: count(props.cards.registered),
    sub: `${count(props.cards.active)} aktif`,
    icon: 'users-three',
    accent: 'action',
  },
  {
    key: 'participation',
    label: 'Kadar Penglibatan',
    value: pct0(props.cards.participationPct),
    sub: 'daripada pelajar daftar',
    icon: 'chart-pie',
    accent: 'friend',
  },
  {
    key: 'answers',
    label: 'Soalan Dijawab',
    value: count(props.cards.answers),
    sub: `sepanjang ${monthNameOf(props.label)}`,
    icon: 'check-circle',
    accent: 'win',
  },
  {
    key: 'accuracy',
    label: 'Ketepatan',
    value: pctWhole(props.cards.accuracy),
    sub: 'purata jawapan betul',
    icon: 'target',
    accent: 'heat',
  },
  {
    key: 'teachers',
    label: 'Guru',
    value: count(props.cards.teachers),
    sub: 'berdaftar',
    icon: 'chalkboard-teacher',
    accent: 'action',
  },
  {
    key: 'depth',
    label: 'Soalan / Pelajar Aktif',
    value: count(props.cards.perPupil),
    sub: 'purata kedalaman penggunaan',
    icon: 'list-numbers',
    accent: 'friend',
  },
  {
    key: 'busiest',
    label: 'Bulan Paling Aktif',
    value: props.cards.busiestMonth?.label ?? NO_DATA,
    sub: props.cards.busiestMonth ? `${count(props.cards.busiestMonth.sessions)} sesi` : NO_DATA,
    icon: 'calendar-check',
    accent: 'win',
  },
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
