<script setup lang="ts">
/**
 * S2 KPI cards, `#section-ringkasan` (FN-M11-3.3.1 / 3.3.2; FR-M11-35, 36). Row 1: six cards
 * (`grid-cols-2 lg:grid-cols-3 xl:grid-cols-6`); row 2: three (`grid-cols-2 sm:grid-cols-3`). Labels
 * are 12 px at every width (DV-M11-23).
 */
import {
  Calculator,
  ChartLine,
  CircleCheck,
  GraduationCap,
  LogIn,
  Pen,
  Percent,
  Presentation,
  School,
} from '@lucide/vue'
import { computed, type Component } from 'vue'

import type { MonitoringKpi } from '../../api/types'
import { avg, CARD, count, pct } from './monitoring-format'

const props = defineProps<{ kpi: MonitoringKpi }>()

interface Card {
  key: string
  label: string
  value: string
  sub?: string
  icon: Component
  tile: string
}

const row1 = computed<Card[]>(() => [
  {
    key: 'schools',
    label: 'Jumlah Sekolah',
    value: count(props.kpi.schools),
    sub: 'Berdaftar',
    icon: School,
    tile: 'from-blue-500 to-indigo-600',
  },
  {
    key: 'students',
    label: 'Pelajar T4/T5',
    value: count(props.kpi.students),
    sub: 'Berdaftar',
    icon: GraduationCap,
    tile: 'from-indigo-500 to-violet-600',
  },
  {
    key: 'engaged',
    label: 'Pernah Aktif',
    value: count(props.kpi.engaged),
    sub: 'Min. 1 soalan',
    icon: CircleCheck,
    tile: 'from-emerald-500 to-green-600',
  },
  {
    key: 'engagement',
    label: '% Penglibatan',
    value: pct(props.kpi.engagementPct),
    sub: 'Keseluruhan',
    icon: ChartLine,
    tile: 'from-amber-500 to-orange-600',
  },
  {
    key: 'answers',
    label: 'Soalan Dijawab',
    value: count(props.kpi.answers),
    sub: 'Total',
    icon: Pen,
    tile: 'from-purple-500 to-fuchsia-600',
  },
  {
    key: 'average',
    label: 'Purata/Pelajar',
    value: avg(props.kpi.avgPerStudent),
    sub: 'Soalan/pelajar aktif',
    icon: Calculator,
    tile: 'from-rose-500 to-pink-600',
  },
])

const row2 = computed<Card[]>(() => [
  {
    key: 'teachers',
    label: 'Guru Berdaftar',
    value: count(props.kpi.teachers),
    icon: Presentation,
    tile: 'from-cyan-500 to-teal-600',
  },
  {
    key: 'teachersLoggedIn',
    label: 'Guru Pernah Login',
    value: count(props.kpi.teachersLoggedIn),
    icon: LogIn,
    tile: 'from-teal-500 to-emerald-600',
  },
  {
    key: 'teacherPct',
    label: '% Penglibatan Guru',
    value: pct(props.kpi.teacherPct),
    icon: Percent,
    tile: 'from-emerald-500 to-green-600',
  },
])
</script>

<template>
  <section id="section-ringkasan" class="scroll-mt-20 space-y-3" data-testid="mon-kpis">
    <div class="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
      <div
        v-for="c in row1"
        :key="c.key"
        :class="[CARD, 'min-w-0 p-3 sm:p-4']"
        :data-testid="`mon-kpi-${c.key}`"
      >
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <p class="text-xs font-semibold text-slate-500 sm:text-sm">{{ c.label }}</p>
            <p
              class="font-heading text-xl font-bold text-slate-800 sm:text-3xl"
              data-testid="mon-kpi-value"
            >
              {{ c.value }}
            </p>
            <p v-if="c.sub" class="text-xs text-slate-400">{{ c.sub }}</p>
          </div>
          <span
            :class="[
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white',
              c.tile,
            ]"
          >
            <component :is="c.icon" class="h-4 w-4" />
          </span>
        </div>
      </div>
    </div>
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <div
        v-for="c in row2"
        :key="c.key"
        :class="[CARD, 'min-w-0 p-3 sm:p-4']"
        :data-testid="`mon-kpi-${c.key}`"
      >
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <p class="text-xs font-semibold text-slate-500 sm:text-sm">{{ c.label }}</p>
            <p
              class="font-heading text-xl font-bold text-slate-800 sm:text-3xl"
              data-testid="mon-kpi-value"
            >
              {{ c.value }}
            </p>
          </div>
          <span
            :class="[
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white',
              c.tile,
            ]"
          >
            <component :is="c.icon" class="h-4 w-4" />
          </span>
        </div>
      </div>
    </div>
  </section>
</template>
