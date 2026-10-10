<script setup lang="ts">
/**
 * S3 Overview tab (FR-M27-68, 69, 70; M17 FN-M17-8.2.1 to 8.2.6 in the school scope). Four cards ("Murid Pernah
 * Login", "Cikgu Pernah Login", "Murid Buat Latihan", "Jumlah Aktiviti"; no "Skor Purata" and no "Struktur"),
 * "Trend Aktiviti" (Chart.js line), "Pecahan Aktiviti", "Pelajar Paling Aktif" (at most 10) and "Cikgu Belum
 * Login" (at most 20, name A to Z with the e-mail). Cards: 2 per row below lg, 4 at lg; the three lists are 1
 * column at 375 and 3 columns from md.
 */
import { CircleAlert, Trophy } from '@lucide/vue'
import type { ChartData, ChartOptions } from 'chart.js'
import { computed } from 'vue'

import { ChartCanvas } from '@/components/chart'

import type { SchoolActivityReport } from '../../api/school-admin'
import { count, wholePercent } from './activity-format'

const props = defineProps<{ report: SchoolActivityReport }>()

const o = computed(() => props.report.overview)

/** FN-M17-8.2.3: label "Aktiviti", #6366f1 line, light fill, tension 0.3, radius 2, no legend, x ticks max 15. */
const chartData = computed<ChartData>(() => ({
  labels: props.report.trend.map((p) => p.label),
  datasets: [
    {
      label: 'Aktiviti',
      data: props.report.trend.map((p) => p.value),
      borderColor: '#6366f1',
      backgroundColor: 'rgba(99, 102, 241, 0.1)',
      fill: true,
      tension: 0.3,
      pointRadius: 2,
    },
  ],
}))
const chartOptions: ChartOptions = {
  plugins: { legend: { display: false } },
  scales: {
    x: { ticks: { maxTicksLimit: 15 } },
    y: { beginAtZero: true },
  },
}

const breakdown = computed(() => [
  { key: 'quiz', label: 'Kuiz Objektif', value: props.report.breakdown.quiz },
  { key: 'structured', label: 'Soalan Berstruktur', value: props.report.breakdown.structured },
  { key: 'battle', label: 'Battle Arena', value: props.report.breakdown.battle },
  { key: 'game', label: 'Permainan', value: props.report.breakdown.game },
])

interface Card {
  key: string
  label: string
  pct?: string
  value: string
  of?: string
  note?: string
  warn?: boolean
  box: string
  labelClass: string
  valueClass: string
}
const cards = computed<Card[]>(() => [
  {
    key: 'pupils-logged',
    label: 'Murid Pernah Login',
    pct: wholePercent(o.value.pupilsLogged, o.value.pupils),
    value: count(o.value.pupilsLogged),
    of: `/ ${count(o.value.pupils)}`,
    note: `${count(o.value.pupils - o.value.pupilsLogged)} belum pernah login`,
    warn: true,
    box: 'border-blue-200 bg-blue-50',
    labelClass: 'text-blue-600',
    valueClass: 'text-blue-900',
  },
  {
    key: 'teachers-logged',
    label: 'Cikgu Pernah Login',
    pct: wholePercent(o.value.teachersLogged, o.value.teachers),
    value: count(o.value.teachersLogged),
    of: `/ ${count(o.value.teachers)}`,
    note: `${count(o.value.teachers - o.value.teachersLogged)} belum pernah login`,
    warn: true,
    box: 'border-teal-200 bg-teal-50',
    labelClass: 'text-teal-600',
    valueClass: 'text-teal-900',
  },
  {
    key: 'practised',
    label: 'Murid Buat Latihan',
    pct: wholePercent(o.value.practised, o.value.pupils),
    value: count(o.value.practised),
    of: `/ ${count(o.value.pupils)}`,
    box: 'border-emerald-200 bg-emerald-50',
    labelClass: 'text-emerald-600',
    valueClass: 'text-emerald-900',
  },
  {
    key: 'activity',
    label: 'Jumlah Aktiviti',
    value: count(o.value.activity),
    note: `${String(props.report.range)} hari lepas`,
    box: 'border-violet-200 bg-violet-50',
    labelClass: 'text-violet-600',
    valueClass: 'text-violet-900',
  },
])
</script>

<template>
  <div class="min-w-0 space-y-4" data-testid="la-overview">
    <div class="grid min-w-0 grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4" data-testid="la-cards">
      <div
        v-for="c in cards"
        :key="c.key"
        :class="['min-w-0 rounded-2xl border p-3 shadow-sm sm:p-5', c.box]"
        :data-testid="`la-card-${c.key}`"
      >
        <p
          :class="['text-xs font-bold tracking-wide break-words uppercase', c.labelClass]"
          data-testid="la-card-label"
        >
          {{ c.label }}
        </p>
        <p v-if="c.pct" :class="['mt-1 text-2xl font-bold sm:text-3xl', c.valueClass]" data-testid="la-card-pct">
          {{ c.pct }}
        </p>
        <p
          :class="[
            'font-bold break-words',
            c.pct ? 'text-sm text-slate-600' : ['mt-1 text-2xl sm:text-3xl', c.valueClass],
          ]"
        >
          <span data-testid="la-card-value">{{ c.value }}</span>
          <span v-if="c.of" class="ml-1 font-normal text-slate-500" data-testid="la-card-of">{{
            c.of
          }}</span>
        </p>
        <p
          v-if="c.note"
          class="mt-1 flex items-center gap-1 text-xs text-slate-500"
          data-testid="la-card-note"
        >
          <CircleAlert v-if="c.warn" class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />{{ c.note }}
        </p>
      </div>
    </div>

    <section
      class="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
      data-testid="la-trend"
    >
      <h2 class="text-base font-bold text-slate-800" data-testid="la-trend-title">Trend Aktiviti</h2>
      <div class="mt-3 min-w-0">
        <ChartCanvas
          type="line"
          :data="chartData"
          :options="chartOptions"
          height="250px"
          test-id="la-trend-chart"
        />
      </div>
    </section>

    <div class="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-3">
      <section
        class="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
        data-testid="la-breakdown"
      >
        <h2 class="text-base font-bold text-slate-800">Pecahan Aktiviti</h2>
        <ul class="mt-3 divide-y divide-slate-100 text-sm">
          <li
            v-for="b in breakdown"
            :key="b.key"
            class="flex items-center justify-between gap-3 py-2.5"
            data-testid="la-breakdown-row"
          >
            <span class="text-slate-600" data-testid="la-breakdown-label">{{ b.label }}</span>
            <span class="font-bold text-slate-800 tabular-nums" data-testid="la-breakdown-value">{{
              count(b.value)
            }}</span>
          </li>
        </ul>
      </section>

      <section
        class="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
        data-testid="la-top"
      >
        <h2 class="flex items-center gap-2 text-base font-bold text-slate-800">
          <Trophy class="h-4 w-4 text-amber-500" aria-hidden="true" />Pelajar Paling Aktif
        </h2>
        <ol class="mt-3 divide-y divide-slate-100 text-sm">
          <li
            v-for="(p, i) in report.topPupils"
            :key="p.userId"
            class="flex min-w-0 items-center gap-3 py-2.5"
            data-testid="la-top-row"
          >
            <span
              class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-700"
              data-testid="la-top-rank"
              >{{ i + 1 }}</span
            >
            <span class="min-w-0 flex-1 truncate text-slate-700" data-testid="la-top-name">{{
              p.name
            }}</span>
            <span class="font-bold text-slate-800 tabular-nums" data-testid="la-top-count">{{
              count(p.activities)
            }}</span>
          </li>
        </ol>
      </section>

      <section
        class="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
        data-testid="la-never"
      >
        <h2 class="text-base font-bold text-slate-800">Cikgu Belum Login</h2>
        <ul class="mt-3 divide-y divide-slate-100 text-sm">
          <li
            v-for="t in report.teachersNeverLogged"
            :key="t.userId"
            class="min-w-0 py-2.5"
            data-testid="la-never-row"
          >
            <p class="truncate font-semibold text-slate-700" data-testid="la-never-name">
              {{ t.name }}
            </p>
            <p class="truncate text-xs text-slate-500" data-testid="la-never-email">{{ t.email }}</p>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>
