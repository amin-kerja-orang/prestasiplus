<script setup lang="ts">
/**
 * S11 `/analisa-item/kelas/{id}` "Papan Guru" (M08-T5; FR-M08-64…74). The API answers 403 for an unknown
 * class or one the viewer may not open, which is the 403 page (FR-M08-08; the route guard already gives
 * it to every role but admin and teacher).
 */
import { ArrowLeft, ChartBar, Filter, Presentation } from '@lucide/vue'
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

import { AlertBox } from '@/components/feedback'

import { fetchClassItemAnalysis, fetchItemAnalysisClasses } from '../api/performance'
import DifficultyTab from '../components/analisa-item/DifficultyTab.vue'
import DiscriminationTab from '../components/analisa-item/DiscriminationTab.vue'
import { LOAD_ERROR, isLoadError, useRouteData } from '../lib/prestasi/load'

const route = useRoute()
const classId = computed(() => Number(route.params.id))

const { data, error, reload } = useRouteData(
  (signal) => fetchClassItemAnalysis(classId.value, { signal }),
  () => classId.value,
  { notFoundAs403: true },
)
const classes = useRouteData((signal) => fetchItemAnalysisClasses({ signal }))
const loadFailed = computed(() => isLoadError(error.value))

const tab = ref<'difficulty' | 'discrimination'>('difficulty')
watch(classId, () => {
  tab.value = 'difficulty'
})

const summary = computed(() => {
  const a = data.value?.analysis
  if (!a) return []
  const q = a.questionCount
  const pct = (n: number): string | null =>
    q > 0 ? `${String(Math.round((n / q) * 100))}% daripada soalan` : null
  return [
    {
      id: 'mudah',
      label: 'Mudah',
      count: a.summary.mudah,
      pct: pct(a.summary.mudah),
      box: 'background: linear-gradient(135deg, #f0fdf4, #dcfce7); border-color: #86efac',
      tile: 'background: linear-gradient(135deg, #22c55e, #16a34a)',
    },
    {
      id: 'sederhana',
      label: 'Sederhana',
      count: a.summary.sederhana,
      pct: pct(a.summary.sederhana),
      box: 'background: linear-gradient(135deg, #fffbeb, #fef3c7); border-color: #fcd34d',
      tile: 'background: linear-gradient(135deg, #f59e0b, #d97706)',
    },
    {
      id: 'sukar',
      label: 'Sukar',
      count: a.summary.sukar,
      pct: pct(a.summary.sukar),
      box: 'background: linear-gradient(135deg, #fef2f2, #fee2e2); border-color: #fca5a5',
      tile: 'background: linear-gradient(135deg, #ef4444, #dc2626)',
    },
  ]
})

const TAB = 'flex min-h-11 items-center gap-2 px-4 py-2 text-sm'
const BADGE = 'rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700'
</script>

<template>
  <div class="min-w-0 space-y-5" data-testid="analisa-item-kelas-page">
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
          to="/dashboard"
          class="inline-flex min-h-11 items-center gap-1 hover:text-slate-700"
          ><ArrowLeft class="h-4 w-4" />Papan Pemuka</RouterLink
        >
        <span>/</span>
        <RouterLink
          to="/analisa-item/kelas"
          class="inline-flex min-h-11 items-center hover:text-slate-700"
          >Pilih Kelas</RouterLink
        >
        <span>/</span>
        <span class="font-semibold text-slate-700">{{ data.class.name }}</span>
      </nav>

      <section
        class="flex flex-wrap items-center gap-4 rounded-2xl bg-white p-4 shadow"
        data-testid="class-card"
      >
        <span
          class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white"
          style="background: linear-gradient(135deg, #6366f1, #4f46e5)"
        >
          <Presentation class="h-6 w-6" />
        </span>
        <div class="min-w-0 flex-1">
          <h2 class="text-lg font-bold break-words text-slate-800" data-testid="class-name">
            {{ data.class.name }}
          </h2>
          <p class="text-sm text-slate-500">
            {{ data.class.subjectName ?? 'Tiada Subjek' }} • {{ data.class.levelSlug }} • Tahun
            {{ data.class.year }}
          </p>
        </div>
        <div class="flex gap-6 text-center">
          <div>
            <p class="text-xl font-bold text-indigo-700" data-testid="class-students">
              {{ data.class.students }}
            </p>
            <p class="text-xs text-slate-500">Pelajar</p>
          </div>
          <div>
            <p class="text-xl font-bold text-indigo-700" data-testid="class-questions">
              {{ data.analysis.questionCount }}
            </p>
            <p class="text-xs text-slate-500">Soalan Diuji</p>
          </div>
        </div>
      </section>

      <div class="grid grid-cols-3 gap-2 sm:gap-4" data-testid="summary-cards">
        <div
          v-for="c in summary"
          :key="c.id"
          class="min-w-0 rounded-2xl border p-3 sm:p-4"
          :style="c.box"
          :data-testid="`summary-${c.id}`"
        >
          <p class="text-xs font-bold tracking-wide text-slate-600 uppercase">{{ c.label }}</p>
          <p class="text-xl font-bold text-slate-800 sm:text-3xl" data-testid="summary-count">
            {{ c.count }}
          </p>
          <p v-if="c.pct" class="text-xs text-slate-500" data-testid="summary-pct">{{ c.pct }}</p>
        </div>
      </div>

      <div class="flex gap-1 overflow-x-auto border-b border-slate-200" data-testid="tabs">
        <button
          type="button"
          :class="[
            TAB,
            tab === 'difficulty'
              ? 'border-b-2 border-indigo-600 font-bold text-indigo-700'
              : 'text-slate-500',
          ]"
          data-testid="tab-difficulty"
          @click="tab = 'difficulty'"
        >
          <ChartBar class="h-4 w-4" />Indeks Kesukaran
          <span :class="BADGE">{{ data.analysis.questionCount }}</span>
        </button>
        <button
          type="button"
          :class="[
            TAB,
            tab === 'discrimination'
              ? 'border-b-2 border-indigo-600 font-bold text-indigo-700'
              : 'text-slate-500',
          ]"
          data-testid="tab-discrimination"
          @click="tab = 'discrimination'"
        >
          <Filter class="h-4 w-4" />Indeks Diskriminasi
          <span :class="BADGE">{{ data.analysis.questionCount }}</span>
        </button>
      </div>

      <DifficultyTab v-if="tab === 'difficulty'" :analysis="data.analysis" />
      <DiscriminationTab v-else :discrimination="data.analysis.discrimination" />

      <section
        v-if="classes.data.value"
        class="rounded-2xl p-4"
        style="background: #f8fafc"
        data-testid="switch-class"
      >
        <h3 class="mb-3 text-sm font-bold text-slate-700">Tukar Kelas</h3>
        <div class="flex max-h-64 flex-wrap gap-2 overflow-y-auto">
          <RouterLink
            v-for="c in classes.data.value"
            :key="c.id"
            :to="`/analisa-item/kelas/${c.id}`"
            :class="[
              'inline-flex min-h-11 items-center rounded-lg border px-3 text-sm',
              c.id === data.class.id ? 'border-transparent text-white' : 'bg-white text-slate-600',
            ]"
            :style="
              c.id === data.class.id
                ? 'background: linear-gradient(135deg, #6366f1, #4f46e5)'
                : 'border-color: #e2e8f0'
            "
            :data-testid="`switch-${c.id}`"
            >{{ c.name }}</RouterLink
          >
        </div>
      </section>
    </template>
  </div>
</template>
