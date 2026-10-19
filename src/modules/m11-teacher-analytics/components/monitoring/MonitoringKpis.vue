<script setup lang="ts">
/**
 * S2 KPI strip, `#section-ringkasan` (FN-M11-3.3.1 / 3.3.2; FR-M11-35, 36). Row 1: six tiles, row 2: the three
 * teacher tiles, both a roomy `DsStatRow` (2 / 3 columns).
 */
import { computed } from 'vue'

import { DsStatRow, type StatItem, DsStack } from '@/ds'

import type { MonitoringKpi } from '../../api/types'
import { avg, count, pct } from './monitoring-format'

const props = defineProps<{ kpi: MonitoringKpi }>()

const row1 = computed<StatItem[]>(() => [
  {
    key: 'schools',
    label: 'Jumlah Sekolah · Berdaftar',
    value: count(props.kpi.schools),
    icon: 'i-ph-buildings',
    accent: 'action',

    valueTone: 'primary',
  },
  {
    key: 'students',
    label: 'Pelajar T4/T5 · Berdaftar',
    value: count(props.kpi.students),
    icon: 'i-ph-graduation-cap',
    accent: 'friend',

    valueTone: 'highlighted',
  },
  {
    key: 'engaged',
    label: 'Pernah Aktif · Min. 1 soalan',
    value: count(props.kpi.engaged),
    icon: 'i-ph-check-circle',
    accent: 'win',

    valueTone: 'success',
  },
  {
    key: 'engagement',
    label: '% Penglibatan · Keseluruhan',
    value: pct(props.kpi.engagementPct),
    icon: 'i-ph-chart-line-up',
    accent: 'heat',

    valueTone: 'primary',
  },
  {
    key: 'answers',
    label: 'Soalan Dijawab · Total',
    value: count(props.kpi.answers),
    icon: 'i-ph-pencil-simple',
    accent: 'trial',

    valueTone: 'highlighted',
  },
  {
    key: 'average',
    label: 'Purata/Pelajar · Soalan/pelajar aktif',
    value: avg(props.kpi.avgPerStudent),
    icon: 'i-ph-calculator',
    accent: 'action',

    valueTone: 'highlighted',
  },
])

const row2 = computed<StatItem[]>(() => [
  {
    key: 'teachers',
    label: 'Guru Berdaftar',
    value: count(props.kpi.teachers),
    icon: 'i-ph-chalkboard-teacher',
    accent: 'friend',

    valueTone: 'highlighted',
  },
  {
    key: 'teachersLoggedIn',
    label: 'Guru Pernah Login',
    value: count(props.kpi.teachersLoggedIn),
    icon: 'i-ph-sign-in',
    accent: 'win',

    valueTone: 'success',
  },
  {
    key: 'teacherPct',
    label: '% Penglibatan Guru',
    value: pct(props.kpi.teacherPct),
    icon: 'i-ph-percent',
    accent: 'heat',

    valueTone: 'primary',
  },
])
</script>

<template>
  <DsStack id="section-ringkasan" as="section" data-testid="mon-kpis">
    <DsStatRow :items="row1" prefix="mon-kpi" :cols="3" density="roomy" />
    <DsStatRow :items="row2" prefix="mon-kpi" :cols="3" density="roomy" />
  </DsStack>
</template>
