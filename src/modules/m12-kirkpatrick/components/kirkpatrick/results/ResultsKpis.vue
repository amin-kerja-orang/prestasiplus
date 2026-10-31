<script setup lang="ts">
/**
 * The six KPI cards of S5 (FN-M12-6.1.1 / 6.1.2; BR-M12-16/18; DV-M12-09/16/28). A school with an SPM row that stores
 * no grade counts (8880, D9 choice) shows "-" for Kadar Lulus and Pelajar Gred A with the candidates as caption, so
 * no "0/0 calon" sits next to a real GPS.
 */
import { computed } from 'vue'

import { DsStatRow, type StatItem } from '@/ds'

import type { Results } from '../../../api/types'
import { count, gps, pct, plain } from '../common/kirkpatrick-format'

const props = defineProps<{ kpi: Results['kpi'] }>()

const gpsCaption = computed(() =>
  props.kpi.gpsYear === null
    ? `${plain(props.kpi.recordsLabel)} rekod`
    : `${plain(props.kpi.recordsLabel)} rekod · ${props.kpi.gpsYear}`,
)
const passCaption = computed(() =>
  props.kpi.pass === null
    ? `${plain(props.kpi.candidates)} calon`
    : `${plain(props.kpi.pass)}/${plain(props.kpi.candidates)} calon`,
)
const gradeACaption = computed(() =>
  props.kpi.gradeA === null
    ? `${plain(props.kpi.candidates)} calon`
    : `${pct(props.kpi.gradeAPct ?? 0)} daripada ${plain(props.kpi.candidates)}`,
)

const items = computed<StatItem[]>(() => [
  {
    key: 'gps',
    label: 'GPS Headcount',
    value: props.kpi.gps === null ? '-' : gps(props.kpi.gps),
    icon: 'i-ph-trophy', accent: 'action',
    sub: gpsCaption.value,
  },
  {
    key: 'pass',
    label: 'Kadar Lulus',
    value: props.kpi.passPct === null ? '-' : pct(props.kpi.passPct),
    icon: 'i-ph-seal-check', accent: 'win',
    sub: passCaption.value,
  },
  {
    key: 'gradeA',
    label: 'Pelajar Gred A',
    value: props.kpi.gradeA === null ? '-' : plain(props.kpi.gradeA),
    icon: 'i-ph-star', accent: 'heat',
    sub: gradeACaption.value,
  },
  {
    key: 'accuracy',
    label: 'Ketepatan Platform',
    value: pct(props.kpi.accuracy),
    icon: 'i-ph-target', accent: 'trial',
    sub: `${count(props.kpi.answers)} soalan`,
  },
  {
    key: 'active',
    label: 'Pelajar Aktif',
    value: plain(props.kpi.active),
    icon: 'i-ph-users', accent: 'friend',
    sub: `${pct(props.kpi.activePct)} daripada ${count(props.kpi.t4t5)}`,
  },
  {
    key: 'records',
    label: 'Rekod Headcount',
    value: plain(props.kpi.records),
    icon: 'i-ph-database', accent: 'action',
    sub: 'Data OTR',
  },
])
</script>

<template>
  <DsStatRow :items="items" prefix="res-kpi" :cols="3" density="roomy" data-testid="res-kpis" />
</template>
