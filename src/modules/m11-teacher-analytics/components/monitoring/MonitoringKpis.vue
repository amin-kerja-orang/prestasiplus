<script setup lang="ts">
/**
 * S2 KPI strip, `#section-ringkasan` (FN-M11-3.3.1 / 3.3.2; FR-M11-35, 36). The nine tiles keep their order and
 * values; they are grouped by meaning (schools and pupils, activity, teachers), one number colour, and each
 * label keeps its qualifier as the tile's sub line.
 */
import { computed } from 'vue'

import { DsStack, DsStatRow, DsText, type StatItem } from '@/ds'

import type { MonitoringKpi } from '../../api/types'
import { avg, count, pct } from './monitoring-format'

const props = defineProps<{ kpi: MonitoringKpi }>()

const all6 = computed<StatItem[]>(() => [
  {
    key: 'schools',
    label: 'Jumlah Sekolah',
    sub: 'Berdaftar',
    value: count(props.kpi.schools),
    icon: 'i-ph-buildings',
    accent: 'action',
  },
  {
    key: 'students',
    label: 'Pelajar T4/T5',
    sub: 'Berdaftar',
    value: count(props.kpi.students),
    icon: 'i-ph-graduation-cap',
    accent: 'friend',
  },
  {
    key: 'engaged',
    label: 'Pernah Aktif',
    sub: 'Min. 1 soalan',
    value: count(props.kpi.engaged),
    icon: 'i-ph-check-circle',
    accent: 'win',
  },
  {
    key: 'engagement',
    label: '% Penglibatan',
    sub: 'Keseluruhan',
    value: pct(props.kpi.engagementPct),
    icon: 'i-ph-chart-line-up',
    accent: 'heat',
  },
  {
    key: 'answers',
    label: 'Soalan Dijawab',
    sub: 'Total',
    value: count(props.kpi.answers),
    icon: 'i-ph-pencil-simple',
    accent: 'trial',
  },
  {
    key: 'average',
    label: 'Purata/Pelajar',
    sub: 'Soalan/pelajar aktif',
    value: avg(props.kpi.avgPerStudent),
    icon: 'i-ph-calculator',
    accent: 'action',
  },
])

const teachers = computed<StatItem[]>(() => [
  {
    key: 'teachers',
    label: 'Guru Berdaftar',
    value: count(props.kpi.teachers),
    icon: 'i-ph-chalkboard-teacher',
    accent: 'friend',
  },
  {
    key: 'teachersLoggedIn',
    label: 'Guru Pernah Login',
    value: count(props.kpi.teachersLoggedIn),
    icon: 'i-ph-sign-in',
    accent: 'win',
  },
  {
    key: 'teacherPct',
    label: '% Penglibatan Guru',
    value: pct(props.kpi.teacherPct),
    icon: 'i-ph-percent',
    accent: 'heat',
  },
])
const pupils = computed(() => all6.value.slice(0, 3))
const activity = computed(() => all6.value.slice(3))
</script>

<template>
  <DsStack as="section" id="section-ringkasan" gap="lg" data-testid="mon-kpis">
    <DsStack gap="sm">
      <DsText variant="overline" tone="muted">Sekolah &amp; Pelajar</DsText>
      <DsStatRow :items="pupils" prefix="mon-kpi" />
    </DsStack>
    <DsStack gap="sm">
      <DsText variant="overline" tone="muted">Aktiviti Pelajar</DsText>
      <DsStatRow :items="activity" prefix="mon-kpi" />
    </DsStack>
    <DsStack gap="sm">
      <DsText variant="overline" tone="muted">Guru</DsText>
      <DsStatRow :items="teachers" prefix="mon-kpi" />
    </DsStack>
  </DsStack>
</template>
