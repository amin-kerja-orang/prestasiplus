<script setup lang="ts">
/**
 * S3 `/prestasi/tingkatan/{t4|t5}` "Dashboard Tingkatan" (M08-T5; FR-M08-23…28). An unknown code is the
 * standard 404 (the API answers 404). "On Track" / "Below Target", the class On Track / Below and the
 * "Murid Berisiko" rows are headcount figures (M08-T1b) and read 0 / empty until they exist.
 */
import { ArrowLeft, GraduationCap } from '@lucide/vue'
import { computed, watchEffect } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

import { AlertBox } from '@/components/feedback'
import { DataTableCard, TABLE_CLASSES as T } from '@/components/data'
import { usePageMeta } from '@/composables/usePageMeta'

import { fetchLevelDetail } from '../api/performance'
import {
  TABLE_TEXT,
  accuracyTone,
  capPct,
  dec2,
  gapText,
  grouped,
  levelNumber,
  pct1,
  pctTrim,
  plain,
  rankTone,
} from '../lib/prestasi/format'
import { LOAD_ERROR, isLoadError, useRouteData } from '../lib/prestasi/load'

const route = useRoute()
const code = computed(() => String(route.params.code ?? ''))
const pageMeta = usePageMeta()

watchEffect(() => {
  if (code.value === 't4' || code.value === 't5') {
    pageMeta.setHeader({
      title: `Tingkatan ${String(levelNumber(code.value))}`,
      subtitle: 'Dashboard Prestasi Tingkatan',
    })
  }
})

const { data, error, reload } = useRouteData(
  (signal) => fetchLevelDetail(code.value, { signal }),
  () => code.value,
)
const loadFailed = computed(() => isLoadError(error.value))

/** Stacked bar widths, unrounded (FR-M08-25); nothing when there is no pair. */
const bar = computed(() => {
  const d = data.value
  const total = d ? d.onTrack + d.below : 0
  return total > 0 && d
    ? { on: (d.onTrack / total) * 100, below: (d.below / total) * 100 }
    : { on: 0, below: 0 }
})

const STAT = 'min-w-0 rounded-2xl bg-white p-3 text-center shadow'
</script>

<template>
  <div class="min-w-0 space-y-5" data-testid="tingkatan-page">
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
      >
        <div class="flex min-w-0 items-center gap-3">
          <RouterLink
            to="/prestasi/tingkatan"
            class="flex h-11 w-11 shrink-0 items-center justify-center text-slate-400 hover:text-slate-600"
            data-testid="back-link"
          >
            <ArrowLeft class="h-5 w-5" />
          </RouterLink>
          <span
            class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"
          >
            <GraduationCap class="h-6 w-6" />
          </span>
          <div class="min-w-0">
            <h1 class="text-lg font-bold text-slate-800">Tingkatan {{ levelNumber(data.code) }}</h1>
            <p class="text-sm text-slate-500" data-testid="level-summary">
              Dashboard Prestasi Tingkatan · {{ plain(data.classes) }} kelas ·
              {{ plain(data.subjects) }} subjek
            </p>
          </div>
        </div>
        <div class="flex gap-2">
          <RouterLink
            v-for="c in ['t4', 't5']"
            :key="c"
            :to="`/prestasi/tingkatan/${c}`"
            :class="[
              'flex min-h-11 min-w-11 items-center justify-center rounded-lg px-4 text-sm font-semibold',
              data.code === c ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600',
            ]"
            :data-testid="`pill-${c}`"
            >{{ c.toUpperCase() }}</RouterLink
          >
        </div>
      </header>

      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6" data-testid="stat-cards">
        <div :class="STAT" data-testid="stat-kelas">
          <p class="text-2xl font-bold text-gray-800">{{ plain(data.classes) }}</p>
          <p class="text-xs text-slate-400">Kelas</p>
        </div>
        <div :class="STAT" data-testid="stat-murid">
          <p class="text-2xl font-bold text-indigo-600">{{ plain(data.students) }}</p>
          <p class="text-xs text-slate-400">Murid</p>
        </div>
        <div :class="STAT" data-testid="stat-ketepatan">
          <p class="text-2xl font-bold text-blue-600">{{ pct1(capPct(data.accuracy)) }}</p>
          <p class="text-xs text-slate-400">Purata Ketepatan</p>
        </div>
        <div :class="STAT" data-testid="stat-sesi">
          <p class="text-2xl font-bold text-emerald-600">{{ grouped(data.sessions) }}</p>
          <p class="text-xs text-slate-400">Jumlah Sesi</p>
        </div>
        <div :class="STAT" data-testid="stat-on">
          <p class="text-2xl font-bold text-green-600">{{ plain(data.onTrack) }}</p>
          <p class="text-xs text-slate-400">On Track</p>
        </div>
        <div :class="STAT" data-testid="stat-below">
          <p class="text-2xl font-bold text-red-600">{{ plain(data.below) }}</p>
          <p class="text-xs text-slate-400">Below Target</p>
        </div>
      </div>

      <section class="min-w-0 rounded-2xl bg-white p-5 shadow" data-testid="headcount-card">
        <div class="mb-2 flex items-center justify-between gap-3 text-sm">
          <span class="text-slate-600">Headcount Keseluruhan</span>
          <span class="font-semibold text-slate-700" data-testid="headcount-pct"
            >{{ data.onTrackPct }}% On Track</span
          >
        </div>
        <div class="flex h-3 overflow-hidden rounded-full bg-slate-100">
          <div class="h-3 bg-emerald-500" :style="{ width: `${bar.on}%` }"></div>
          <div class="h-3 bg-red-500" :style="{ width: `${bar.below}%` }"></div>
        </div>
        <div class="mt-2 flex flex-wrap gap-x-5 text-xs text-slate-500">
          <span class="flex items-center gap-1.5"
            ><span class="h-2 w-2 rounded-full bg-emerald-500"></span>On Track:
            {{ data.onTrack }}</span
          >
          <span class="flex items-center gap-1.5"
            ><span class="h-2 w-2 rounded-full bg-red-500"></span>Below Target:
            {{ data.below }}</span
          >
        </div>
      </section>

      <DataTableCard :min-width="860" data-testid="class-card">
        <template #header>
          <h3 class="bg-slate-50 px-5 py-4 text-base font-bold text-slate-800">
            Perbandingan Kelas
          </h3>
        </template>
        <table :class="T.table" data-testid="class-table">
          <thead>
            <tr>
              <th :class="T.th">Kelas</th>
              <th :class="T.th">Subjek</th>
              <th :class="T.th">Guru</th>
              <th :class="[T.th, 'text-center']">Murid</th>
              <th :class="[T.th, 'text-center']">Sesi</th>
              <th :class="[T.th, 'text-center']">Ketepatan</th>
              <th :class="[T.th, 'text-center']">On Track</th>
              <th :class="[T.th, 'text-center']">Below</th>
              <th :class="[T.th, 'text-center']">Aksi</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="r in data.classRows"
              :key="`${r.kind}-${r.classId}`"
              :class="T.row"
              :data-testid="`class-row-${r.classId}`"
            >
              <td :class="[T.td, 'font-semibold whitespace-nowrap text-slate-800']">
                {{ r.name }}
              </td>
              <td :class="[T.td, 'whitespace-nowrap']">{{ r.subject }}</td>
              <td :class="[T.td, 'whitespace-nowrap']">{{ r.teacher ?? '—' }}</td>
              <td :class="[T.td, 'text-center']">{{ r.students }}</td>
              <td :class="[T.td, 'text-center']">{{ r.sessions }}</td>
              <td
                :class="[T.td, 'text-center font-semibold', TABLE_TEXT[accuracyTone(r.accuracy)]]"
              >
                {{ pctTrim(capPct(r.accuracy)) }}
              </td>
              <td
                :class="[
                  T.td,
                  'text-center',
                  r.onTrack > 0 ? 'font-semibold text-green-600' : 'text-gray-400',
                ]"
              >
                {{ r.onTrack }}
              </td>
              <td
                :class="[
                  T.td,
                  'text-center',
                  r.below > 0 ? 'font-semibold text-red-600' : 'text-gray-400',
                ]"
              >
                {{ r.below }}
              </td>
              <td :class="[T.td, 'text-center whitespace-nowrap']">
                <RouterLink
                  v-if="r.href"
                  :to="r.href"
                  class="inline-flex min-h-11 items-center text-sm text-blue-700"
                  >Lihat →</RouterLink
                >
              </td>
            </tr>
          </tbody>
        </table>
      </DataTableCard>

      <div class="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section class="min-w-0 rounded-2xl bg-white p-5 shadow" data-testid="top-students">
          <h3 class="mb-3 text-base font-bold text-slate-800">Murid Terbaik</h3>
          <ol class="max-h-96 space-y-2 overflow-y-auto">
            <li
              v-for="(s, i) in data.topStudents"
              :key="s.userId"
              class="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2"
              :data-testid="`top-${s.userId}`"
            >
              <span :class="['w-5 shrink-0 text-center text-sm font-bold', rankTone(i + 1)]">{{
                i + 1
              }}</span>
              <span class="min-w-0 flex-1">
                <span class="block text-sm font-semibold break-words text-slate-800">{{
                  s.name
                }}</span>
                <span class="block text-xs text-slate-500"
                  >{{ s.sessions }} sesi · {{ s.answered }} soalan</span
                >
              </span>
              <span class="shrink-0 text-sm font-bold text-emerald-600">{{
                pctTrim(capPct(s.accuracy))
              }}</span>
            </li>
          </ol>
        </section>

        <section class="min-w-0 rounded-2xl bg-white p-5 shadow" data-testid="at-risk">
          <h3 class="mb-3 text-base font-bold text-slate-800">Murid Berisiko</h3>
          <div class="max-h-96 space-y-2 overflow-y-auto">
            <RouterLink
              v-for="r in data.atRisk"
              :key="`${r.userId}-${r.className}-${r.checkpoint}`"
              :to="`/prestasi/${r.userId}`"
              class="flex min-h-11 items-center gap-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2"
              data-testid="at-risk-row"
            >
              <span class="min-w-0 flex-1">
                <span class="block text-sm font-semibold break-words text-slate-800">{{
                  r.name
                }}</span>
                <span class="block text-xs text-slate-500"
                  >{{ r.className }} · OTR{{ r.checkpoint }}: {{ dec2(r.ar) }}% (sasaran
                  {{ dec2(r.target) }}%)</span
                >
              </span>
              <span class="shrink-0 text-sm font-bold text-red-600">{{ gapText(r.gap) }}</span>
            </RouterLink>
          </div>
        </section>
      </div>
    </template>
  </div>
</template>
