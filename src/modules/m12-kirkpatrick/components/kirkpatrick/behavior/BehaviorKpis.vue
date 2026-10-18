<script setup lang="ts">
/** The six KPI cards of S4 (FN-M12-5.2.1; BR-M12-02/03/05/07) in a `DsStatRow`. */
import { computed } from 'vue'

import { DsStatRow, type StatItem } from '@/ds'

import type { Behavior } from '../../../api/types'
import { count, pct, plain } from '../common/kirkpatrick-format'

const props = defineProps<{ kpi: Behavior['kpi'] }>()

const items = computed<StatItem[]>(() => [
  {
    key: 't4t5',
    label: 'Pelajar T4/T5',
    value: count(props.kpi.t4t5),
    icon: 'i-ph-graduation-cap', accent: 'friend',
  },
  {
    key: 'active',
    label: 'Pernah Aktif',
    value: plain(props.kpi.active),
    icon: 'i-ph-check-circle', accent: 'win',
  },
  { key: 'sessions', label: 'Jumlah Sesi', value: plain(props.kpi.sessions), icon: 'i-ph-timer', accent: 'heat' },
  {
    key: 'answers',
    label: 'Soalan Dijawab',
    value: count(props.kpi.answers),
    icon: 'i-ph-pencil-simple', accent: 'trial',
  },
  { key: 'accuracy', label: 'Ketepatan', value: pct(props.kpi.accuracy), icon: 'i-ph-target', accent: 'action' },
  {
    key: 'teachers',
    label: 'Guru Aktif',
    value: pct(props.kpi.teacherPct),
    icon: 'i-ph-chalkboard-teacher', accent: 'win',
    sub: `${plain(props.kpi.teachersLoggedIn)}/${plain(props.kpi.teachers)}`,
  },
])
</script>

<template>
  <DsStatRow :items="items" prefix="beh-kpi" :cols="3" roomy data-testid="beh-kpis" />
</template>
