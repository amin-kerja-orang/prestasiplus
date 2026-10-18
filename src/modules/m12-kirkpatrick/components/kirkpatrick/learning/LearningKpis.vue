<script setup lang="ts">
/**
 * S3 six KPI cards (FN-M12-4.1.1; FR-M12-34) in a `DsStatRow`. "Learning Gain" is "-" permanently (there
 * are no pre/post tests).
 */
import { computed } from 'vue'

import { DsStatRow, type StatItem } from '@/ds'

import type { Learning } from '../../../api/types'
import { count, pct, plain } from '../common'

const props = defineProps<{ kpi: Learning['kpi'] }>()

const items = computed<StatItem[]>(() => [
  {
    key: 'answers',
    label: 'Soalan Dijawab',
    value: count(props.kpi.answers),
    icon: 'i-ph-pencil-simple', accent: 'trial',
  },
  { key: 'accuracy', label: 'Ketepatan', value: pct(props.kpi.accuracy), icon: 'i-ph-target', accent: 'action' },
  {
    key: 'score',
    label: 'Skor Purata',
    value: pct(props.kpi.avgScore),
    icon: 'i-ph-chart-line-up', accent: 'friend',
  },
  {
    key: 'sessions',
    label: 'Sesi Selesai',
    value: `${plain(props.kpi.sessionsCompleted)}/${plain(props.kpi.sessions)}`,
    icon: 'i-ph-flag-checkered', accent: 'win',
  },
  {
    key: 'completion',
    label: 'Kadar Penyelesaian',
    value: pct(props.kpi.completionPct),
    icon: 'i-ph-percent', accent: 'heat',
  },
  {
    key: 'gain',
    label: 'Learning Gain',
    value: '-',
    icon: 'i-ph-brain', accent: 'trial',
    sub: 'Perlu pre/post test',
    valueClass: 'text-dimmed',
  },
])
</script>

<template>
  <DsStatRow :items="items" prefix="kirk-kpi" :cols="3" density="roomy" data-testid="kirk-learning-kpis" />
</template>
