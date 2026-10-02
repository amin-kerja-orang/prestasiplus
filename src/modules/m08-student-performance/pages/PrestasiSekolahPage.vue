<script setup lang="ts">
/**
 * S1 `/prestasi/sekolah` "Dashboard Sekolah" (M08-T5; FR-M08-11…21). From `GET /api/performance/school`:
 * the admin sees the platform, the school admin and every other role the own school (FR-M08-13).
 * GPS, grade distribution, subject rows and the teacher On Track / Below come from the headcount
 * figures (M08-T1b) and show "—", 0 and "Tiada data headcount" until they exist.
 */
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import { AlertBox } from '@/components/feedback'

import { fetchSchoolPerformance } from '../api/performance'
import GpsCard from '../components/prestasi/GpsCard.vue'
import GpsTrendCard from '../components/prestasi/GpsTrendCard.vue'
import GradeDistribution from '../components/prestasi/GradeDistribution.vue'
import LevelAndTeachers from '../components/prestasi/LevelAndTeachers.vue'
import SubjectGpsTable from '../components/prestasi/SubjectGpsTable.vue'
import { grouped, pct1, plain } from '../lib/prestasi/format'
import { LOAD_ERROR, isLoadError, useRouteData } from '../lib/prestasi/load'

const { data, error, reload } = useRouteData((signal) => fetchSchoolPerformance({ signal }))
const loadFailed = computed(() => isLoadError(error.value))

const PILL = 'rounded-full border px-3 py-1.5 text-xs font-semibold transition hover:shadow-sm'
const NAV =
  'block rounded-xl border p-4 text-center text-sm font-semibold transition hover:shadow-md'

const cards = computed(() => {
  const s = data.value?.stats
  if (!s) return []
  return [
    { id: 'murid', label: 'Murid', value: plain(s.students), tone: 'text-slate-800' },
    { id: 'guru', label: 'Guru', value: plain(s.teachers), tone: 'text-indigo-400' },
    { id: 'kelas', label: 'Kelas', value: plain(s.classes), tone: 'text-blue-400' },
    { id: 'subjek', label: 'Subjek', value: plain(s.subjects), tone: 'text-purple-400' },
    { id: 'sesi', label: 'Sesi Latihan', value: plain(s.sessions), tone: 'text-emerald-400' },
    { id: 'soalan', label: 'Soalan Dijawab', value: grouped(s.answered), tone: 'text-amber-400' },
    { id: 'ketepatan', label: 'Purata Ketepatan', value: pct1(s.accuracy), tone: 'text-cyan-400' },
  ]
})
</script>

<template>
  <div class="min-w-0 space-y-5" data-testid="prestasi-sekolah-page">
    <div v-if="loadFailed" class="space-y-3" data-testid="page-error">
      <AlertBox :messages="LOAD_ERROR" />
      <button
        type="button"
        class="inline-flex min-h-11 items-center justify-center rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white shadow transition hover:bg-indigo-700"
        @click="reload()"
      >
        Cuba Semula
      </button>
    </div>

    <template v-else-if="data">
      <header
        class="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow"
        data-testid="school-header"
      >
        <div class="flex min-w-0 items-center gap-3">
          <span
            class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-2xl"
            >🏫</span
          >
          <div class="min-w-0">
            <h1 class="text-lg font-bold text-slate-800">Dashboard Sekolah</h1>
            <p class="text-sm text-slate-500" data-testid="header-summary">
              Ringkasan prestasi keseluruhan · {{ plain(data.header.classCount) }} kelas ·
              {{ plain(data.header.studentCount) }} murid
            </p>
          </div>
        </div>
        <div class="flex flex-wrap gap-2">
          <RouterLink
            to="/prestasi/tingkatan"
            :class="[PILL, 'min-h-11 content-center border-indigo-300 text-indigo-600']"
            >Tingkatan</RouterLink
          >
          <RouterLink
            to="/prestasi/kelas"
            :class="[PILL, 'min-h-11 content-center border-blue-300 text-blue-600']"
            >Kelas</RouterLink
          >
        </div>
      </header>

      <div class="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7" data-testid="stat-cards">
        <div
          v-for="c in cards"
          :key="c.id"
          class="min-w-0 rounded-2xl bg-white p-3 text-center shadow"
          :data-testid="`stat-${c.id}`"
        >
          <p
            :class="['text-sm font-bold break-words sm:text-2xl', c.tone]"
            data-testid="stat-value"
          >
            {{ c.value }}
          </p>
          <p class="text-xs text-slate-400">{{ c.label }}</p>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <GpsCard :gps="data.gps" />
        <GradeDistribution :distribution="data.distribution" />
      </div>

      <GpsTrendCard :trend="data.trend" />
      <SubjectGpsTable :subjects="data.subjects" />
      <LevelAndTeachers :levels="data.levels" :teachers="data.teachers" />

      <section class="min-w-0 rounded-2xl bg-white p-5 shadow" data-testid="quick-nav">
        <h3 class="mb-4 text-base font-bold text-slate-700">🔗 Navigasi Pantas</h3>
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <RouterLink
            to="/prestasi/tingkatan"
            :class="[NAV, 'border-indigo-100 bg-indigo-50 text-indigo-700']"
            >🎓 Dashboard Tingkatan</RouterLink
          >
          <RouterLink
            to="/prestasi/kelas"
            :class="[NAV, 'border-blue-100 bg-blue-50 text-blue-700']"
            >📊 Dashboard Kelas</RouterLink
          >
          <RouterLink to="/headcount" :class="[NAV, 'border-amber-100 bg-amber-50 text-amber-700']"
            >📈 Headcount</RouterLink
          >
          <RouterLink
            to="/analisa-item/sekolah"
            :class="[NAV, 'border-emerald-100 bg-emerald-50 text-emerald-700']"
            >🔬 Analisa Item</RouterLink
          >
        </div>
      </section>
    </template>
  </div>
</template>
