<script setup lang="ts">
/**
 * S2 KPI strip, `#section-ringkasan` (FN-M11-3.3.1 / 3.3.2; FR-M11-35, 36). Row 1: six tiles
 * (`grid-cols-2 lg:grid-cols-3 xl:grid-cols-6`); row 2: the three teacher tiles. Roomy `DsStatTile`s.
 */
import { computed } from 'vue'

import { DsStatTile } from '@/ds'
import type { DsAccent } from '@/ds/types'

import type { MonitoringKpi } from '../../api/types'
import { avg, count, pct } from './monitoring-format'

const props = defineProps<{ kpi: MonitoringKpi }>()

interface Card {
  key: string
  label: string
  value: string
  icon: string
  accent: DsAccent
  tone: string
}

const row1 = computed<Card[]>(() => [
  {
    key: 'schools',
    label: 'Jumlah Sekolah · Berdaftar',
    value: count(props.kpi.schools),
    icon: 'i-ph-buildings',
    accent: 'action',
    tone: 'text-primary',
  },
  {
    key: 'students',
    label: 'Pelajar T4/T5 · Berdaftar',
    value: count(props.kpi.students),
    icon: 'i-ph-graduation-cap',
    accent: 'friend',
    tone: 'text-highlighted',
  },
  {
    key: 'engaged',
    label: 'Pernah Aktif · Min. 1 soalan',
    value: count(props.kpi.engaged),
    icon: 'i-ph-check-circle',
    accent: 'win',
    tone: 'text-success',
  },
  {
    key: 'engagement',
    label: '% Penglibatan · Keseluruhan',
    value: pct(props.kpi.engagementPct),
    icon: 'i-ph-chart-line-up',
    accent: 'heat',
    tone: 'text-primary',
  },
  {
    key: 'answers',
    label: 'Soalan Dijawab · Total',
    value: count(props.kpi.answers),
    icon: 'i-ph-pencil-simple',
    accent: 'trial',
    tone: 'text-highlighted',
  },
  {
    key: 'average',
    label: 'Purata/Pelajar · Soalan/pelajar aktif',
    value: avg(props.kpi.avgPerStudent),
    icon: 'i-ph-calculator',
    accent: 'action',
    tone: 'text-highlighted',
  },
])

const row2 = computed<Card[]>(() => [
  {
    key: 'teachers',
    label: 'Guru Berdaftar',
    value: count(props.kpi.teachers),
    icon: 'i-ph-chalkboard-teacher',
    accent: 'friend',
    tone: 'text-highlighted',
  },
  {
    key: 'teachersLoggedIn',
    label: 'Guru Pernah Login',
    value: count(props.kpi.teachersLoggedIn),
    icon: 'i-ph-sign-in',
    accent: 'win',
    tone: 'text-success',
  },
  {
    key: 'teacherPct',
    label: '% Penglibatan Guru',
    value: pct(props.kpi.teacherPct),
    icon: 'i-ph-percent',
    accent: 'heat',
    tone: 'text-primary',
  },
])
</script>

<template>
  <section id="section-ringkasan" class="flex flex-col gap-4" data-testid="mon-kpis">
    <div class="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
      <DsStatTile
        v-for="c in row1"
        :key="c.key"
        roomy
        :value="c.value"
        :unit="c.label"
        :icon="c.icon"
        :accent="c.accent"
        :value-class="c.tone"
        :data-testid="`mon-kpi-${c.key}`"
      />
    </div>
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <DsStatTile
        v-for="c in row2"
        :key="c.key"
        roomy
        :value="c.value"
        :unit="c.label"
        :icon="c.icon"
        :accent="c.accent"
        :value-class="c.tone"
        :data-testid="`mon-kpi-${c.key}`"
      />
    </div>
  </section>
</template>
