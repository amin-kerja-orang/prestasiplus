<script setup lang="ts">
/**
 * S8 `/spm/subjektif` "Latihan Subjektif SPM" (M06-T3; FR-M06-54…57, 61, BR-M06-12/18, DV-M06-09).
 *
 * Info box, four stat cards of the caller's SPM subjective attempts, tabs Semua / Teras / Elektif that
 * switch the card grid client-side, and one card per subject → S9 (the M05 structured list with
 * `scope=spm`). The active "Semua" tab is dark with white text (DV-M06-09: live is unreadable).
 */
import { ArrowLeft, ChevronRight, Info, PenLine, Pen } from '@lucide/vue'
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'

import { useApi } from '@/composables'
import { formatCount } from '@/lib/number'

import { fetchSubjektif } from '../api'
import LoadError from '../components/LoadError.vue'
import SkeletonCards from '../components/SkeletonCards.vue'
import SubjectIcon from '../components/SubjectIcon.vue'
import { bestScoreLabel, subjektifHref, tabSubjects, type SubjektifTab } from '../lib/tracking'

const { data, error, reload } = useApi((signal) => fetchSubjektif({ signal }))

const tab = ref<SubjektifTab>('all')
const visible = computed(() => (data.value ? tabSubjects(data.value.subjects, tab.value) : []))

const counts = computed(() => {
  const subjects = data.value?.subjects ?? []
  return {
    all: subjects.length,
    teras: subjects.filter((s) => s.group === 'teras').length,
    elektif: subjects.filter((s) => s.group === 'elektif').length,
  }
})

const TABS: { id: SubjektifTab; label: string; on: string }[] = [
  { id: 'all', label: 'Semua', on: 'bg-slate-900 text-white' },
  { id: 'teras', label: 'Teras', on: 'bg-teal-600 text-white' },
  { id: 'elektif', label: 'Elektif', on: 'bg-amber-500 text-white' },
]

const stats = computed(() => {
  const s = data.value?.stats
  if (!s) return []
  return [
    {
      id: 'answered',
      label: 'Set Dijawab',
      value: formatCount(s.setsAnswered),
      cap: 'Percubaan subjektif SPM yang telah dihantar',
      cls: 'text-indigo-600',
    },
    {
      id: 'subjects',
      label: 'Subjek Dicuba',
      value: formatCount(s.subjectsTried),
      cap: 'Bilangan subjek subjektif SPM yang pernah dicuba',
      cls: 'text-teal-600',
    },
    {
      id: 'best',
      label: 'Skor Terbaik',
      value: bestScoreLabel(s.bestScore),
      cap: 'Skor tertinggi merentas semua set subjektif SPM',
      cls: 'text-amber-600',
    },
    {
      id: 'saved',
      label: 'Set Terbaik Disimpan',
      value: formatCount(s.bestSetsSaved),
      cap: 'Bilangan set yang mempunyai percubaan terbaik tersimpan',
      cls: 'text-rose-600',
    },
  ]
})
</script>

<template>
  <div class="min-h-screen px-2 py-4 sm:px-6 sm:py-8 lg:px-8" data-testid="subjektif-page">
    <div class="mx-auto max-w-7xl">
      <RouterLink
        to="/spm"
        class="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-800"
        data-testid="spm-back"
      >
        <ArrowLeft class="h-4 w-4" aria-hidden="true" />
        Kembali ke Mod SPM
      </RouterLink>

      <div class="mb-5 sm:mb-6">
        <h1
          class="flex items-center gap-2 font-heading text-2xl font-extrabold text-slate-800 sm:text-3xl"
          data-testid="spm-heading"
        >
          <PenLine class="h-6 w-6 shrink-0 text-teal-600 sm:h-7 sm:w-7" aria-hidden="true" />
          Latihan Subjektif SPM
        </h1>
        <p class="mt-1 text-sm text-slate-600 sm:text-base" data-testid="spm-sub">
          Pilih subjek untuk menjawab set struktur dan esei SPM berasaskan bank subjektif Tingkatan
          4 dan 5.
        </p>
      </div>

      <div
        class="mb-5 flex items-start gap-2 rounded-2xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900 sm:p-4"
        data-testid="subjektif-info"
      >
        <Info class="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <p>
          <strong>Bagaimana ia berfungsi?</strong>
          Pilih subjek → jawab set struktur/subjektif SPM → semak markah dan model jawapan. Bank ini
          ditarik daripada soalan berstruktur Tingkatan 4 dan 5 yang telah diterbitkan.
        </p>
      </div>

      <template v-if="data">
        <div
          class="mb-5 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4"
          data-testid="subjektif-stats"
        >
          <div
            v-for="s in stats"
            :key="s.id"
            class="min-w-0 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm sm:p-4"
            :data-testid="`subjektif-stat-${s.id}`"
          >
            <p
              class="text-xs font-bold tracking-wider text-slate-500 uppercase"
              data-testid="stat-label"
            >
              {{ s.label }}
            </p>
            <p :class="['mt-1 text-2xl font-extrabold', s.cls]" data-testid="stat-value">
              {{ s.value }}
            </p>
            <p class="mt-1 text-xs text-slate-500" data-testid="stat-caption">{{ s.cap }}</p>
          </div>
        </div>

        <div class="mb-4 flex flex-wrap gap-2" data-testid="subjektif-tabs">
          <button
            v-for="t in TABS"
            :key="t.id"
            type="button"
            :class="[
              'inline-flex min-h-11 items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold shadow-sm transition',
              tab === t.id
                ? t.on
                : 'border border-slate-200 bg-white text-slate-700 hover:border-slate-300',
            ]"
            :data-testid="`tab-${t.id}`"
            :data-active="tab === t.id ? 'true' : 'false'"
            @click="tab = t.id"
          >
            {{ t.label }}
            <span
              :class="[
                'rounded-full px-2 py-0.5 text-xs font-bold',
                tab === t.id ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-600',
              ]"
              data-testid="tab-count"
              >{{ counts[t.id] }}</span
            >
          </button>
        </div>

        <div
          class="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3"
          data-testid="subjektif-grid"
        >
          <RouterLink
            v-for="s in visible"
            :key="s.subjectId"
            :to="subjektifHref(s.subjectId)"
            class="group flex min-w-0 items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
            :data-testid="`subjektif-card-${s.subjectId}`"
          >
            <div
              class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl"
              :style="{ background: `${s.color}22`, color: s.color }"
              data-testid="subjektif-icon"
            >
              <SubjectIcon :icon="s.icon" class="h-6 w-6" />
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <h3
                  class="font-heading text-base font-extrabold break-words text-slate-800"
                  data-testid="subjektif-name"
                >
                  {{ s.name }}
                </h3>
                <span
                  :class="[
                    'rounded-full px-2 py-0.5 text-xs font-bold',
                    s.group === 'teras'
                      ? 'bg-teal-100 text-teal-700'
                      : 'bg-amber-100 text-amber-800',
                  ]"
                  data-testid="subjektif-badge"
                  >{{ s.group === 'teras' ? 'Teras' : 'Elektif' }}</span
                >
              </div>
              <p class="text-xs text-slate-500" data-testid="subjektif-name-en">{{ s.nameEn }}</p>
              <span
                class="mt-2 inline-flex items-center gap-1 rounded-lg bg-rose-50 px-2 py-1 text-xs font-bold text-rose-700"
                data-testid="subjektif-sets"
              >
                <Pen class="h-3 w-3" aria-hidden="true" />
                {{ formatCount(s.sets) }} set subjektif
              </span>
            </div>
            <ChevronRight class="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
          </RouterLink>
        </div>
      </template>
      <LoadError v-else-if="error" @retry="reload()" />
      <SkeletonCards v-else />
    </div>
  </div>
</template>
