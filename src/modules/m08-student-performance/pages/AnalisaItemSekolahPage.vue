<script setup lang="ts">
/**
 * S9 `/analisa-item/sekolah[/{id}]` "Analisa Item Sekolah" (M08-T5; FR-M08-58…61, 141…143, BR-M08-17).
 * The viewer's own school, or school `{id}` (admin any, officers their scope, others own school, else the
 * 403 page; an unknown school is the 404 page). Header figures that the data does not supply (`null`,
 * DV-M08-32) show "—", never 0. GPS and the other headcount figures come from M08-T1b.
 */
import { ArrowLeft, ChartPie, GraduationCap, School, UserX } from '@lucide/vue'
import { computed, watchEffect } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

import { ChartCanvas } from '@/components/chart'
import { DataTableCard, TABLE_CLASSES as T } from '@/components/data'
import { AlertBox } from '@/components/feedback'
import { usePrototypeScope } from '@/composables'
import { usePageMeta } from '@/composables/usePageMeta'

import { fetchSchoolItemAnalysis } from '../api/performance'
import SchoolQuestionList from '../components/analisa-item/SchoolQuestionList.vue'
import { BAND_STYLE, DASH, dec2, grouped, pct1 } from '../lib/prestasi/format'
import { sparklineConfig } from '../lib/prestasi/gps-chart'
import { LOAD_ERROR, isLoadError, useRouteData } from '../lib/prestasi/load'

const route = useRoute()
const pageMeta = usePageMeta()
const { home, allows } = usePrototypeScope()

const schoolId = computed(() => {
  const raw = route.params.id
  const n = Number(Array.isArray(raw) ? raw[0] : raw)
  return raw === undefined || raw === '' ? undefined : n
})
/** An unknown `tingkatan` value activates no chip and filters nothing (FR-M08-59). */
const tingkatan = computed<'T4' | 'T5' | null>(() => {
  const q = route.query.tingkatan
  const v = Array.isArray(q) ? q[0] : q
  return v === 'T4' || v === 'T5' ? v : null
})

/** An unknown `tingkatan` value activates no chip, not even "Semua" (FR-M08-59). */
const hasQuery = computed(() => route.query.tingkatan !== undefined)

const { data, error, reload } = useRouteData(
  (signal) =>
    fetchSchoolItemAnalysis({
      ...(schoolId.value === undefined ? {} : { schoolId: schoolId.value }),
      tingkatan: tingkatan.value,
      signal,
    }),
  [() => schoolId.value, () => tingkatan.value],
)
const loadFailed = computed(() => isLoadError(error.value))

watchEffect(() => {
  const d = data.value
  if (!d || d.school.name === '') return
  pageMeta.setHeader({
    title: 'Analisa Item — Sekolah',
    subtitle: tingkatan.value
      ? `${d.school.name} — Tingkatan ${tingkatan.value.slice(1)}`
      : d.school.name,
  })
})

const base = computed(() =>
  schoolId.value === undefined
    ? '/analisa-item/sekolah'
    : `/analisa-item/sekolah/${String(schoolId.value)}`,
)
const chips = computed(() => [
  { label: 'Semua', to: base.value, active: !hasQuery.value },
  { label: 'Tingkatan 4', to: `${base.value}?tingkatan=T4`, active: tingkatan.value === 'T4' },
  { label: 'Tingkatan 5', to: `${base.value}?tingkatan=T5`, active: tingkatan.value === 'T5' },
])

const emptyCopy = computed(() =>
  data.value?.variant === 'byId'
    ? 'Tiada data pelajar untuk sekolah ini. Pastikan pelajar telah berdaftar dan menjawab soalan.'
    : 'Tiada data pelajar untuk sekolah ini. Pastikan pelajar telah berdaftar dan menjawab soalan latihan.',
)

const difficulty = computed(() => {
  const d = data.value?.difficulty
  if (!d) return null
  const total = d.mudah + d.sederhana + d.sukar
  return { ...d, total }
})
const spark = computed(() => (data.value ? sparklineConfig(data.value.gps.years) : null))

const CARD = 'min-w-0 rounded-2xl bg-white p-5 shadow'
const STAT_LABEL = 'text-xs text-slate-500'
</script>

<template>
  <div class="min-w-0 space-y-5" data-testid="analisa-item-sekolah-page">
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
      <nav
        class="flex flex-wrap items-center gap-2 text-sm text-slate-500"
        data-testid="breadcrumb"
      >
        <RouterLink
          :to="home"
          class="inline-flex min-h-11 items-center gap-1 hover:text-slate-700"
          ><ArrowLeft class="h-4 w-4" />Papan Pemuka</RouterLink
        >
        <span>/</span>
        <span class="font-semibold text-slate-700">Analisa Item Sekolah</span>
      </nav>

      <section
        v-if="data.school.name"
        class="flex flex-wrap items-center gap-4 rounded-2xl border p-4"
        style="background: linear-gradient(135deg, #eff6ff, #eef2ff); border-color: #c7d2fe"
        data-testid="school-card"
      >
        <span
          class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white"
          style="background: linear-gradient(135deg, #4f46e5, #3730a3)"
        >
          <School class="h-6 w-6" />
        </span>
        <div class="min-w-0 flex-1">
          <h2 class="text-lg font-bold break-words text-slate-800" data-testid="school-name">
            {{ data.school.name }}
          </h2>
          <div class="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <span class="rounded px-2 py-0.5 text-xs font-semibold" style="background: #e2e8f0">{{
              data.school.type
            }}</span>
            <span v-if="data.school.code" class="font-mono text-xs">{{ data.school.code }}</span>
            <span v-if="data.school.district"
              >{{ data.school.district }} • {{ data.school.state }}</span
            >
            <span v-else>{{ data.school.state }}</span>
          </div>
        </div>
        <div class="flex gap-6 text-center">
          <div>
            <p class="text-xl font-bold text-indigo-700" data-testid="school-students">
              {{ grouped(data.students) }}
            </p>
            <p class="text-xs text-slate-500">Pelajar</p>
          </div>
          <div>
            <p class="text-xl font-bold text-indigo-700" data-testid="school-answers">
              {{ data.answers === null ? DASH : grouped(data.answers) }}
            </p>
            <p class="text-xs text-slate-500">Jawapan</p>
          </div>
        </div>
      </section>

      <div class="flex flex-wrap items-center gap-2" data-testid="tingkatan-chips">
        <span class="flex items-center gap-1 text-sm text-slate-500"
          ><GraduationCap class="h-4 w-4" />Tingkatan:</span
        >
        <RouterLink
          v-for="c in chips"
          :key="c.label"
          :to="c.to"
          :class="[
            'flex min-h-11 items-center rounded-full px-4 text-sm font-semibold',
            c.active ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600',
          ]"
          >{{ c.label }}</RouterLink
        >
      </div>

      <section
        v-if="data.students === 0"
        :class="[CARD, 'py-10 text-center']"
        data-testid="school-empty"
      >
        <UserX class="mx-auto h-12 w-12 text-slate-300" />
        <h3 class="mt-3 text-lg font-bold text-slate-800">Tiada Data Pelajar</h3>
        <p class="mx-auto mt-1 max-w-md text-sm text-slate-500">{{ emptyCopy }}</p>
      </section>

      <template v-else>
        <div class="grid grid-cols-2 gap-3 md:grid-cols-3" data-testid="school-stats">
          <div :class="[CARD, 'text-center']" data-testid="stat-pelajar">
            <p class="text-2xl font-bold text-slate-800">{{ grouped(data.students) }}</p>
            <p :class="STAT_LABEL">Jumlah Pelajar</p>
          </div>
          <div :class="[CARD, 'text-center']" data-testid="stat-soalan">
            <p class="text-2xl font-bold text-amber-500">
              {{ data.answers === null ? DASH : grouped(data.answers) }}
            </p>
            <p :class="STAT_LABEL">Soalan Dijawab</p>
          </div>
          <div :class="[CARD, 'col-span-2 text-center md:col-span-1']" data-testid="stat-ketepatan">
            <p class="text-2xl font-bold text-cyan-500">
              {{ data.accuracy === null ? DASH : pct1(data.accuracy) }}
            </p>
            <p :class="STAT_LABEL">Ketepatan Keseluruhan</p>
          </div>
        </div>

        <div class="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <section :class="CARD" data-testid="difficulty-card">
            <h3 class="mb-3 text-base font-bold text-slate-800">Profil Kesukaran</h3>
            <p v-if="!difficulty || difficulty.total === 0" class="text-sm text-slate-400">
              Tiada data
            </p>
            <template v-else>
              <div class="flex h-4 overflow-hidden rounded-full bg-slate-100">
                <div
                  class="bg-green-500"
                  :style="{ width: `${(difficulty.mudah / difficulty.total) * 100}%` }"
                  :title="`Mudah: ${difficulty.mudah}`"
                ></div>
                <div
                  class="bg-amber-400"
                  :style="{ width: `${(difficulty.sederhana / difficulty.total) * 100}%` }"
                  :title="`Sederhana: ${difficulty.sederhana}`"
                ></div>
                <div
                  class="bg-red-500"
                  :style="{ width: `${(difficulty.sukar / difficulty.total) * 100}%` }"
                  :title="`Sukar: ${difficulty.sukar}`"
                ></div>
              </div>
              <div class="mt-3 grid grid-cols-3 text-center text-sm">
                <div data-testid="diff-mudah">
                  <p class="font-bold text-green-600">{{ difficulty.mudah }}</p>
                  <p class="text-xs text-slate-500">Mudah</p>
                </div>
                <div data-testid="diff-sederhana">
                  <p class="font-bold text-amber-500">{{ difficulty.sederhana }}</p>
                  <p class="text-xs text-slate-500">Sederhana</p>
                </div>
                <div data-testid="diff-sukar">
                  <p class="font-bold text-red-600">{{ difficulty.sukar }}</p>
                  <p class="text-xs text-slate-500">Sukar</p>
                </div>
              </div>
            </template>
          </section>

          <section :class="CARD" data-testid="school-gps-card">
            <h3 class="mb-3 text-base font-bold text-slate-800">GPS Anggaran Sekolah</h3>
            <div class="flex flex-wrap items-center gap-3">
              <span
                :class="[
                  'text-3xl font-bold',
                  data.gps.band ? BAND_STYLE[data.gps.band].text : 'text-slate-400',
                ]"
                data-testid="school-gps-value"
                >{{ data.gps.value === null ? DASH : dec2(data.gps.value) }}</span
              >
              <span
                v-if="data.gps.band"
                :class="[
                  'rounded-full border px-3 py-0.5 text-xs font-semibold',
                  BAND_STYLE[data.gps.band].pill,
                ]"
                >{{ data.gps.band }}</span
              >
            </div>
            <p class="mt-1 text-xs text-slate-500">
              Berdasarkan {{ data.gps.entries }} entri headcount • Lebih rendah = lebih baik
            </p>
            <ChartCanvas
              v-if="spark"
              type="line"
              :data="spark.data"
              :options="spark.options"
              height="80px"
              class="mt-3"
              test-id="school-gps-spark"
            />
            <RouterLink
              v-if="allows(`/sekolah/${data.school.id}/prestasi`)"
              :to="`/sekolah/${data.school.id}/prestasi`"
              class="mt-3 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-indigo-600"
              ><ChartPie class="h-4 w-4" />Prestasi 360</RouterLink
            >
          </section>
        </div>

        <section :class="CARD" data-testid="school-subjects">
          <h3 class="text-base font-bold text-slate-800">Prestasi Mengikut Subjek</h3>
          <p class="mb-3 text-sm text-slate-500">
            Ringkasan ketepatan dan jawapan salah bagi setiap subjek
          </p>
          <DataTableCard :min-width="520">
            <table :class="T.table" data-testid="subject-table">
              <thead>
                <tr>
                  <th :class="T.th">Subjek</th>
                  <th :class="[T.th, 'text-center']">Pelajar</th>
                  <th :class="[T.th, 'text-center']">Soalan</th>
                  <th :class="[T.th, 'text-center']">Ketepatan</th>
                  <th :class="[T.th, 'text-center']">Salah</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="s in data.subjects" :key="s.subjectId" :class="T.row">
                  <td :class="[T.td, 'font-semibold text-slate-800']">{{ s.name }}</td>
                  <td :class="[T.td, 'text-center']">{{ grouped(s.pupils) }}</td>
                  <td :class="[T.td, 'text-center']">{{ grouped(s.questions) }}</td>
                  <td :class="[T.td, 'text-center']">{{ pct1(s.accuracy) }}</td>
                  <td :class="[T.td, 'text-center']">{{ grouped(s.wrong) }}</td>
                </tr>
              </tbody>
            </table>
          </DataTableCard>
        </section>

        <SchoolQuestionList v-if="data.questions.length > 0" :questions="data.questions" />
      </template>
    </template>
  </div>
</template>
