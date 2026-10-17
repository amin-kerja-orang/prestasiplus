<script setup lang="ts">
/**
 * S1 seven tiles in order (FR-M27-52; restyle spec AS-46): Pelajar, Guru, Pelajar Aktif ("daripada
 * {Pelajar}"), Penglibatan ("daripada pelajar daftar"), Sesi Latihan, Soalan Dijawab, Purata Ketepatan.
 * Not links. 2 per row at 375, 4 + 3 per row from 768.
 */
import { computed } from 'vue'

import type { SchoolUsage } from '../../api/school-admin'
import StatRow, { type StatItem } from '../shared/StatRow.vue'
import { accuracy, count, wholePercent } from './usage-format'

const props = defineProps<{ tiles: SchoolUsage['tiles'] }>()

const items = computed<StatItem[]>(() => {
  const t = props.tiles
  return [
    { key: 'pupils', label: 'Pelajar', value: count(t.pupils), icon: 'i-ph-graduation-cap' },
    { key: 'teachers', label: 'Guru', value: count(t.teachers), icon: 'i-ph-chalkboard-teacher' },
    {
      key: 'active',
      label: 'Pelajar Aktif',
      value: count(t.activePupils),
      sub: `daripada ${count(t.pupils)}`,
      icon: 'i-ph-user-check',
    },
    {
      key: 'participation',
      label: 'Penglibatan',
      value: wholePercent(t.participationPct),
      sub: 'daripada pelajar daftar',
      icon: 'i-ph-chart-pie',
    },
    {
      key: 'sessions',
      label: 'Sesi Latihan',
      value: count(t.sessions),
      icon: 'i-ph-clipboard-text',
    },
    { key: 'answers', label: 'Soalan Dijawab', value: count(t.answers), icon: 'i-ph-check-circle' },
    {
      key: 'accuracy',
      label: 'Purata Ketepatan',
      value: accuracy(t.accuracy),
      icon: 'i-ph-target',
    },
  ]
})
</script>

<template>
  <StatRow :items="items" prefix="su-tile" nav-id="su-tiles" />
</template>
