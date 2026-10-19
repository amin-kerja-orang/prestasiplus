<script setup lang="ts">
/**
 * S1 seven tiles in order (FR-M27-52; restyle spec AS-46): Pelajar, Guru, Pelajar Aktif ("daripada
 * {Pelajar}"), Penglibatan ("daripada pelajar daftar"), Sesi Latihan, Soalan Dijawab, Purata Ketepatan.
 * Not links. 2 per row at 375, 4 + 3 per row from 768.
 */
import { computed } from 'vue'

import type { SchoolUsage } from '../../api/school-admin'
import { DsStatRow, type StatItem } from '@/ds'
import { accuracy, count, wholePercent } from './usage-format'

const props = defineProps<{ tiles: SchoolUsage['tiles'] }>()

const items = computed<StatItem[]>(() => {
  const t = props.tiles
  return [
    { key: 'pupils', label: 'Pelajar', value: count(t.pupils), icon: 'graduation-cap', accent: 'action' },
    { key: 'teachers', label: 'Guru', value: count(t.teachers), icon: 'chalkboard-teacher', accent: 'friend' },
    {
      key: 'active',
      label: 'Pelajar Aktif',
      value: count(t.activePupils),
      sub: `daripada ${count(t.pupils)}`,
      icon: 'user-check',
      accent: 'win',
    },
    {
      key: 'participation',
      label: 'Penglibatan',
      value: wholePercent(t.participationPct),
      sub: 'daripada pelajar daftar',
      icon: 'chart-pie',
      accent: 'heat',
    },
    {
      key: 'sessions',
      label: 'Sesi Latihan',
      value: count(t.sessions),
      icon: 'clipboard-text',
      accent: 'trial',
    },
    { key: 'answers', label: 'Soalan Dijawab', value: count(t.answers), icon: 'check-circle', accent: 'win' },
    {
      key: 'accuracy',
      label: 'Purata Ketepatan',
      value: accuracy(t.accuracy),
      icon: 'target',
      accent: 'heat',
    },
  ]
})
</script>

<template>
  <DsStatRow :items="items" prefix="su-tile" part-prefix="su-tile" data-testid="su-tiles" :cols="4" />
</template>
