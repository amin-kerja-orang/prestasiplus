<script setup lang="ts">
/**
 * S2 KPI cards, `#section-ringkasan` (FN-M11-3.3.1 / 3.3.2; FR-M11-35, 36). Row 1: six cards
 * (`grid-cols-2 lg:grid-cols-3 xl:grid-cols-6`); row 2: three (`grid-cols-2 sm:grid-cols-3`).
 */
import { computed } from 'vue'

import { DsIconChip } from '@/ds'

import type { MonitoringKpi } from '../../api/types'
import { avg, count, pct } from './monitoring-format'

const props = defineProps<{ kpi: MonitoringKpi }>()

interface Card {
  key: string
  label: string
  value: string
  sub?: string
  icon: string
}

const row1 = computed<Card[]>(() => [
  {
    key: 'schools',
    label: 'Jumlah Sekolah',
    value: count(props.kpi.schools),
    sub: 'Berdaftar',
    icon: 'i-ph-buildings',
  },
  {
    key: 'students',
    label: 'Pelajar T4/T5',
    value: count(props.kpi.students),
    sub: 'Berdaftar',
    icon: 'i-ph-graduation-cap',
  },
  {
    key: 'engaged',
    label: 'Pernah Aktif',
    value: count(props.kpi.engaged),
    sub: 'Min. 1 soalan',
    icon: 'i-ph-check-circle',
  },
  {
    key: 'engagement',
    label: '% Penglibatan',
    value: pct(props.kpi.engagementPct),
    sub: 'Keseluruhan',
    icon: 'i-ph-chart-line-up',
  },
  {
    key: 'answers',
    label: 'Soalan Dijawab',
    value: count(props.kpi.answers),
    sub: 'Total',
    icon: 'i-ph-pencil-simple',
  },
  {
    key: 'average',
    label: 'Purata/Pelajar',
    value: avg(props.kpi.avgPerStudent),
    sub: 'Soalan/pelajar aktif',
    icon: 'i-ph-calculator',
  },
])

const row2 = computed<Card[]>(() => [
  {
    key: 'teachers',
    label: 'Guru Berdaftar',
    value: count(props.kpi.teachers),
    icon: 'i-ph-chalkboard-teacher',
  },
  {
    key: 'teachersLoggedIn',
    label: 'Guru Pernah Login',
    value: count(props.kpi.teachersLoggedIn),
    icon: 'i-ph-sign-in',
  },
  {
    key: 'teacherPct',
    label: '% Penglibatan Guru',
    value: pct(props.kpi.teacherPct),
    icon: 'i-ph-percent',
  },
])
</script>

<template>
  <section id="section-ringkasan" class="flex flex-col gap-3" data-testid="mon-kpis">
    <div class="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
      <UCard v-for="c in row1" :key="c.key" class="min-w-0" :data-testid="`mon-kpi-${c.key}`">
        <div class="flex items-start justify-between gap-2">
          <div class="flex min-w-0 flex-col gap-1">
            <p class="text-caption text-muted">{{ c.label }}</p>
            <p class="tabular text-heading text-highlighted" data-testid="mon-kpi-value">
              {{ c.value }}
            </p>
            <p v-if="c.sub" class="text-caption text-dimmed">{{ c.sub }}</p>
          </div>
          <DsIconChip :icon="c.icon" />
        </div>
      </UCard>
    </div>
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <UCard v-for="c in row2" :key="c.key" class="min-w-0" :data-testid="`mon-kpi-${c.key}`">
        <div class="flex items-start justify-between gap-2">
          <div class="flex min-w-0 flex-col gap-1">
            <p class="text-caption text-muted">{{ c.label }}</p>
            <p class="tabular text-heading text-highlighted" data-testid="mon-kpi-value">
              {{ c.value }}
            </p>
          </div>
          <DsIconChip :icon="c.icon" />
        </div>
      </UCard>
    </div>
  </section>
</template>
