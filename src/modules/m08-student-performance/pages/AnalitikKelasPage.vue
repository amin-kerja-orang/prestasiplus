<script setup lang="ts">
/**
 * S8 `/analitik/kelas` "Analitik Kelas" (M08-T7; FR-M08-54…57, BR-M08-15). A GET form whose selects
 * submit on change: the URL keeps the live query names `classroom_id`, `subject_id`, `risk_level`.
 * A class the viewer may not open is the 403 page (§7 #8).
 */
import { ArrowDown, ArrowUp, ChartLine, Minus, SquareArrowOutUpRight, Users } from '@lucide/vue'
import { computed } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import { DataTableCard, TABLE_CLASSES as T } from '@/components/data'
import { AlertBox } from '@/components/feedback'

import { fetchClassAnalytics } from '../api/class'
import type { RiskLevel } from '../api/types'
import { pct1 } from '../lib/prestasi/format'
import { LOAD_ERROR, isLoadError, useRouteData } from '../lib/prestasi/load'

const route = useRoute()
const router = useRouter()

const queryInt = (key: string): number | undefined => {
  const raw = route.query[key]
  const v = Array.isArray(raw) ? raw[0] : raw
  return typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : undefined
}
const queryText = (key: string): string => {
  const raw = route.query[key]
  const v = Array.isArray(raw) ? raw[0] : raw
  return typeof v === 'string' ? v : ''
}

const classroomId = computed(() => queryInt('classroom_id'))
const subjectId = computed(() => queryInt('subject_id'))
const riskLevel = computed(() => queryText('risk_level') as RiskLevel | '')

const { data, error, reload } = useRouteData(
  (signal) =>
    fetchClassAnalytics(
      {
        ...(classroomId.value === undefined ? {} : { classroomId: classroomId.value }),
        ...(subjectId.value === undefined ? {} : { subjectId: subjectId.value }),
        riskLevel: riskLevel.value,
      },
      { signal },
    ),
  [() => classroomId.value, () => subjectId.value, () => riskLevel.value],
)
const loadFailed = computed(() => isLoadError(error.value))

const RISKS: { value: RiskLevel | ''; label: string }[] = [
  { value: '', label: 'Semua Risiko' },
  { value: 'critical', label: 'Kritikal' },
  { value: 'high', label: 'Tinggi' },
  { value: 'medium', label: 'Sederhana' },
  { value: 'low', label: 'Rendah' },
]
const RISK_BADGE: Record<RiskLevel, { label: string; cls: string }> = {
  critical: { label: 'Kritikal', cls: 'bg-red-100 text-red-700' },
  high: { label: 'Tinggi', cls: 'bg-orange-100 text-orange-700' },
  medium: { label: 'Sederhana', cls: 'bg-amber-100 text-amber-700' },
  low: { label: 'Rendah', cls: 'bg-green-100 text-green-700' },
}

/** Submit on change (GET form): the three filters of the current selection, empty ones left out. */
function submit(change: { classroom_id?: string; subject_id?: string; risk_level?: string }): void {
  const sel = data.value?.options.selected
  const next: Record<string, string> = {}
  const cid =
    change.classroom_id ?? (sel?.classroomId === null ? '' : String(sel?.classroomId ?? ''))
  const sid =
    change.classroom_id !== undefined
      ? ''
      : (change.subject_id ?? (sel?.subjectId === null ? '' : String(sel?.subjectId ?? '')))
  const rl = change.risk_level ?? riskLevel.value
  if (cid) next.classroom_id = cid
  if (sid) next.subject_id = sid
  if (rl) next.risk_level = rl
  void router.push({ path: '/analitik/kelas', query: next })
}
const onChange = (key: 'classroom_id' | 'subject_id' | 'risk_level') => (e: Event) =>
  submit({ [key]: (e.target as HTMLSelectElement).value })

/** Unjuran "{low} – {high}" (DV-16). */
const range = (p: { low: string; high: string }): string => `${p.low} – ${p.high}`
/** Ketepatan colour: red < 50 (OBSERVED), the FR-M08-50 bands otherwise (INFERRED). */
const accTone = (n: number): string =>
  n < 50 ? 'text-red-600' : n < 75 ? 'text-amber-600' : 'text-green-600'

const SELECT =
  'min-h-11 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700'
const LABEL = 'mb-1 block text-xs font-bold tracking-wide text-slate-500 uppercase'
const CARD = 'min-w-0 rounded-2xl bg-white p-4 text-center shadow'
</script>

<template>
  <div class="min-w-0 space-y-5" data-testid="analitik-kelas-page">
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
      <form
        class="grid grid-cols-1 gap-3 rounded-2xl bg-white p-4 shadow md:grid-cols-3"
        data-testid="filters"
        @submit.prevent
      >
        <div class="min-w-0">
          <label :class="LABEL" for="f-kelas">Kelas</label>
          <select
            id="f-kelas"
            :class="SELECT"
            name="classroom_id"
            :value="data.options.selected.classroomId ?? ''"
            data-testid="filter-kelas"
            @change="onChange('classroom_id')($event)"
          >
            <option v-for="c in data.options.classes" :key="c.id" :value="String(c.id)">
              {{ c.name }}
            </option>
          </select>
        </div>
        <div class="min-w-0">
          <label :class="LABEL" for="f-subjek">Mata Pelajaran</label>
          <select
            id="f-subjek"
            :class="SELECT"
            name="subject_id"
            :value="data.options.selected.subjectId ?? ''"
            data-testid="filter-subjek"
            @change="onChange('subject_id')($event)"
          >
            <option v-for="s in data.options.subjects" :key="s.id" :value="String(s.id)">
              {{ s.name }}
            </option>
          </select>
        </div>
        <div class="min-w-0">
          <label :class="LABEL" for="f-risiko">Risiko</label>
          <select
            id="f-risiko"
            :class="SELECT"
            name="risk_level"
            :value="data.options.selected.riskLevel"
            data-testid="filter-risiko"
            @change="onChange('risk_level')($event)"
          >
            <option v-for="r in RISKS" :key="r.value" :value="r.value">{{ r.label }}</option>
          </select>
        </div>
      </form>

      <section
        v-if="data.summary === null"
        class="rounded-2xl bg-white p-8 text-center shadow"
        data-testid="analitik-empty"
      >
        <ChartLine class="mx-auto h-10 w-10 text-slate-300" />
        <p class="mt-3 text-sm text-slate-500">Tiada data analitik untuk kelas dan subjek ini.</p>
      </section>

      <template v-else>
        <div class="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="summary-cards">
          <div :class="CARD" data-testid="sum-pelajar">
            <p class="text-2xl font-bold text-slate-700">{{ data.summary.students }}</p>
            <p class="text-xs text-slate-400">Jumlah Pelajar</p>
          </div>
          <div :class="CARD" data-testid="sum-ketepatan">
            <p class="text-2xl font-bold text-blue-600">
              {{ pct1(data.summary.accuracy) }}
            </p>
            <p class="text-xs text-slate-400">Purata Ketepatan</p>
          </div>
          <div :class="CARD" data-testid="sum-berisiko">
            <p
              :class="[
                'text-2xl font-bold',
                data.summary.atRisk === 0 ? 'text-green-600' : 'text-red-600',
              ]"
            >
              {{ data.summary.atRisk }}
            </p>
            <p class="text-xs text-slate-400">Pelajar Berisiko</p>
          </div>
          <div :class="CARD" data-testid="sum-baik">
            <p class="text-2xl font-bold text-emerald-600">{{ data.summary.good }}</p>
            <p class="text-xs text-slate-400">Prestasi Baik</p>
          </div>
        </div>

        <DataTableCard :min-width="760" data-testid="list-card">
          <template #header>
            <h3 class="flex items-center gap-2 px-5 py-4 text-sm font-bold text-slate-800">
              <Users class="h-4 w-4 text-blue-500" />Senarai Pelajar
            </h3>
          </template>
          <table :class="T.table" data-testid="student-table">
            <thead>
              <tr>
                <th :class="T.th">#</th>
                <th :class="T.th">Pelajar</th>
                <th :class="[T.th, 'text-center']">Ketepatan</th>
                <th :class="[T.th, 'text-center']">Soalan</th>
                <th :class="[T.th, 'text-center']">Trend</th>
                <th :class="[T.th, 'text-center']">Unjuran</th>
                <th :class="[T.th, 'text-center']">Risiko</th>
                <th :class="[T.th, 'text-center']">Tindakan</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(r, i) in data.rows"
                :key="r.userId"
                :class="T.row"
                :data-testid="`student-row-${r.userId}`"
              >
                <td :class="[T.td, 'text-slate-400']">{{ i + 1 }}</td>
                <td :class="T.td">
                  <RouterLink
                    :to="`/prestasi/${r.userId}`"
                    class="inline-flex min-h-11 items-center gap-1.5 font-semibold text-slate-800 hover:text-blue-700"
                    >{{ r.name }}<SquareArrowOutUpRight class="h-3.5 w-3.5 text-slate-400"
                  /></RouterLink>
                </td>
                <td :class="[T.td, 'text-center font-bold', accTone(r.accuracy)]">
                  {{ r.accuracy.toFixed(1) }}%
                </td>
                <td :class="[T.td, 'text-center']">{{ r.answered }}</td>
                <td :class="[T.td, 'text-center']">
                  <ArrowUp v-if="r.trend === 'up'" class="mx-auto h-4 w-4 text-green-600" />
                  <ArrowDown v-else-if="r.trend === 'down'" class="mx-auto h-4 w-4 text-red-600" />
                  <Minus v-else class="mx-auto h-4 w-4 text-slate-400" />
                </td>
                <td :class="[T.td, 'text-center font-semibold whitespace-nowrap text-blue-600']">
                  {{ range(r.projection) }}
                </td>
                <td :class="[T.td, 'text-center']">
                  <span
                    :class="[
                      'rounded-full px-2.5 py-0.5 text-xs font-semibold',
                      RISK_BADGE[r.riskLevel].cls,
                    ]"
                    data-testid="risk-badge"
                    >{{ RISK_BADGE[r.riskLevel].label }}</span
                  >
                </td>
                <td :class="[T.td, 'text-center']">
                  <RouterLink
                    :to="`/prestasi/${r.userId}`"
                    class="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-semibold whitespace-nowrap text-blue-700"
                    ><ChartLine class="h-3.5 w-3.5" />Lihat Analitik</RouterLink
                  >
                </td>
              </tr>
            </tbody>
          </table>
        </DataTableCard>
      </template>
    </template>
  </div>
</template>
