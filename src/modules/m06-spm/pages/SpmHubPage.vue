<script setup lang="ts">
/**
 * S1 `/spm` "Mod SPM" (M06-T2; FR-M06-01…05, BR-M06-01, DV-M06-01/03/04).
 *
 * Pill, gradient h1 and lead; four stat cards (2 columns, 4 from `md`); four module cards as whole-card
 * links (1 / `md` 2 / `lg` 4 columns) with visible icons (the live Font Awesome Pro names render blank,
 * DV-M06-03); "Prestasi SPM Anda" (the caller's SPM stats) and the "Sejarah Kuiz SPM" link.
 */
import {
  ArrowRight,
  Database,
  Dumbbell,
  FileText,
  GraduationCap,
  History,
  PenTool,
  Sparkles,
  WandSparkles,
  Brain,
} from '@lucide/vue'
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import { useApi } from '@/composables'
import { formatCount, formatNumber } from '@/lib/number'

import { fetchSpmOverview } from '../api'
import LoadError from '../components/LoadError.vue'

const { data, error, reload } = useApi((signal) => fetchSpmOverview({ signal }))

const stats = computed(() => {
  const o = data.value
  if (!o) return []
  return [
    {
      id: 'total',
      value: formatCount(o.stats.totalQuestions),
      label: 'Jumlah Soalan',
      cls: 'text-amber-600',
    },
    {
      id: 'subjects',
      value: formatCount(o.stats.subjectCount),
      label: 'Subjek SPM',
      cls: 'text-blue-600',
    },
    {
      id: 'years',
      value: formatCount(o.stats.yearsAvailable),
      label: 'Tahun Tersedia',
      cls: 'text-green-600',
    },
    {
      id: 'tracking',
      value: formatCount(o.stats.trackingAQuestions),
      label: 'Soalan Tracking A',
      cls: 'text-purple-600',
    },
  ]
})

const modules = computed(() => {
  const o = data.value
  if (!o) return []
  return [
    {
      id: 'databank',
      to: '/spm/tahun-lepas',
      title: 'Databank Soalan',
      text: 'Bank soalan SPM mengikut subjek, dipaparkan secara rawak.',
      chip: `${formatCount(o.modules.databank)} soalan`,
      tile: 'bg-indigo-100 text-indigo-600',
      chipCls: 'bg-indigo-50 text-indigo-700',
      icon: Database,
      chipIcon: FileText,
    },
    {
      id: 'latih-tubi',
      to: '/spm/latih-tubi',
      title: 'Latih Tubi SPM',
      text: 'Latihan ikut topik dan bab untuk Tingkatan 4 & 5.',
      chip: `${formatCount(o.modules.latihTubi)} soalan`,
      tile: 'bg-blue-100 text-blue-600',
      chipCls: 'bg-blue-50 text-blue-700',
      icon: Brain,
      chipIcon: Dumbbell,
    },
    {
      id: 'tracking-a',
      to: '/spm/ramalan',
      title: 'Tracking A',
      text: 'Set objektif penuh dan lane bahasa khas untuk latihan intensif menjelang SPM.',
      chip: `${formatCount(o.modules.trackingA)} soalan`,
      tile: 'bg-purple-100 text-purple-600',
      chipCls: 'bg-purple-50 text-purple-700',
      icon: WandSparkles,
      chipIcon: Sparkles,
    },
    {
      id: 'subjektif',
      to: '/spm/subjektif',
      title: 'Subjektif',
      text: 'Latihan soalan esei & jawapan panjang, disemak oleh guru.',
      chip: `${formatCount(o.modules.subjektifSets)} set subjektif`,
      tile: 'bg-rose-100 text-rose-600',
      chipCls: 'bg-rose-50 text-rose-700',
      icon: PenTool,
      chipIcon: null,
    },
  ]
})

const mine = computed(() => {
  const m = data.value?.me
  if (!m) return []
  return [
    { id: 'sessions', value: formatCount(m.sessions), label: 'Sesi Kuiz', cls: 'text-indigo-600' },
    {
      id: 'accuracy',
      value: `${formatNumber(m.avgAccuracy, { decimals: 1 })}%`,
      label: 'Purata Ketepatan',
      cls: 'text-green-600',
    },
    { id: 'coins', value: formatCount(m.coins), label: 'Syiling Diperoleh', cls: 'text-amber-600' },
    {
      id: 'answered',
      value: formatCount(m.answered),
      label: 'Soalan Dijawab',
      cls: 'text-blue-600',
    },
  ]
})
</script>

<template>
  <div class="min-h-screen px-2 py-4 sm:px-6 sm:py-8 lg:px-8" data-testid="spm-hub-page">
    <div class="mx-auto max-w-7xl">
      <!-- Hero -->
      <div class="mb-6 text-center sm:mb-8">
        <span
          class="mb-3 inline-flex items-center gap-2 rounded-full bg-amber-100 px-4 py-1.5 text-xs font-bold tracking-wider text-amber-700"
          data-testid="spm-pill"
        >
          <GraduationCap class="h-4 w-4" aria-hidden="true" />
          MOD SPM
        </span>
        <h1
          class="bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 bg-clip-text font-heading text-2xl font-extrabold text-transparent"
          data-testid="spm-title"
        >
          Persediaan SPM
        </h1>
        <p
          class="mx-auto mt-2 max-w-2xl text-sm text-slate-600 sm:text-base"
          data-testid="spm-lead"
        >
          Latihan lengkap untuk pelajar Tingkatan 4 &amp; 5. Soalan tahun lepas, latih tubi,
          Tracking A, dan latihan bahasa berformat sebenar.
        </p>
      </div>

      <template v-if="data">
        <!-- Stats -->
        <div
          class="mb-6 grid grid-cols-2 gap-3 sm:mb-8 sm:gap-4 md:grid-cols-4"
          data-testid="spm-stats"
        >
          <div
            v-for="s in stats"
            :key="s.id"
            class="rounded-2xl border border-slate-100 bg-white p-3 text-center shadow-sm sm:p-5"
            :data-testid="`spm-stat-${s.id}`"
          >
            <div
              :class="['font-heading text-2xl font-extrabold sm:text-3xl', s.cls]"
              data-testid="stat-value"
            >
              {{ s.value }}
            </div>
            <div
              class="mt-1 text-xs font-medium text-slate-500 sm:text-sm"
              data-testid="stat-label"
            >
              {{ s.label }}
            </div>
          </div>
        </div>

        <!-- Module cards -->
        <div
          class="mb-6 grid grid-cols-1 gap-4 sm:mb-8 md:grid-cols-2 lg:grid-cols-4"
          data-testid="spm-modules"
        >
          <RouterLink
            v-for="m in modules"
            :key="m.id"
            :to="m.to"
            class="group flex flex-col rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
            :data-testid="`spm-module-${m.id}`"
          >
            <div :class="['mb-4 flex h-12 w-12 items-center justify-center rounded-xl', m.tile]">
              <component
                :is="m.icon"
                class="h-6 w-6"
                data-testid="module-icon"
                aria-hidden="true"
              />
            </div>
            <h2 class="mb-1 font-heading text-lg font-extrabold text-slate-800">{{ m.title }}</h2>
            <p class="mb-4 flex-1 text-sm text-slate-600">{{ m.text }}</p>
            <div class="flex items-center justify-between gap-2">
              <span
                :class="[
                  'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold',
                  m.chipCls,
                ]"
                data-testid="module-chip"
              >
                <component
                  :is="m.chipIcon"
                  v-if="m.chipIcon"
                  class="h-3.5 w-3.5"
                  aria-hidden="true"
                />
                {{ m.chip }}
              </span>
              <span class="inline-flex items-center gap-1 text-sm font-bold text-amber-600">
                Mula
                <ArrowRight
                  class="h-4 w-4 transition-transform group-hover:translate-x-1"
                  aria-hidden="true"
                />
              </span>
            </div>
          </RouterLink>
        </div>

        <!-- My SPM performance -->
        <section
          class="mb-6 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-6"
          data-testid="spm-mine"
        >
          <h2 class="mb-4 font-heading text-lg font-extrabold text-slate-800">Prestasi SPM Anda</h2>
          <div class="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
            <div
              v-for="s in mine"
              :key="s.id"
              class="text-center"
              :data-testid="`spm-mine-${s.id}`"
            >
              <div
                :class="['font-heading text-2xl font-extrabold', s.cls]"
                data-testid="mine-value"
              >
                {{ s.value }}
              </div>
              <div class="text-xs font-medium text-slate-500 sm:text-sm" data-testid="mine-label">
                {{ s.label }}
              </div>
            </div>
          </div>
        </section>

        <div class="text-center">
          <RouterLink
            to="/spm/history"
            class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-800 px-6 py-2.5 text-sm font-bold text-white shadow transition hover:bg-slate-900"
            data-testid="spm-history-link"
          >
            <History class="h-4 w-4" aria-hidden="true" />
            Sejarah Kuiz SPM
          </RouterLink>
        </div>
      </template>

      <div v-else-if="error">
        <LoadError @retry="reload()" />
      </div>
      <div
        v-else
        class="grid grid-cols-2 gap-3 md:grid-cols-4"
        aria-busy="true"
        data-testid="spm-skeleton"
      >
        <div v-for="n in 4" :key="n" class="h-24 animate-pulse rounded-2xl bg-slate-100"></div>
      </div>
    </div>
  </div>
</template>
