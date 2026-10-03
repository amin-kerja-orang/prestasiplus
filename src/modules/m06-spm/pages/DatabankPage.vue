<script setup lang="ts">
/**
 * S2 `/spm/tahun-lepas` "Databank Soalan SPM" (M06-T2; FR-M06-16…19, BR-M06-02/06, DV-M06-03).
 *
 * 18 subject cards (1 / `md` 2 / `lg` 3 columns), not links. "Pilih set:" 5 / 10 / 20 are links to Q1;
 * the amber "Mula" is plain text as live (D-5, replicated). Every query parameter is ignored.
 */
import { ArrowLeft, Database } from '@lucide/vue'
import { RouterLink } from 'vue-router'

import { useApi } from '@/composables'
import { formatCount } from '@/lib/number'

import { fetchDatabank } from '../api'
import LoadError from '../components/LoadError.vue'
import SkeletonCards from '../components/SkeletonCards.vue'
import SubjectIcon from '../components/SubjectIcon.vue'

const COUNTS = [5, 10, 20] as const

const { data, error, reload } = useApi((signal) => fetchDatabank({ signal }))
</script>

<template>
  <div class="min-h-screen px-2 py-4 sm:px-6 sm:py-8 lg:px-8" data-testid="spm-databank-page">
    <div class="mx-auto max-w-7xl">
      <RouterLink
        to="/spm"
        class="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-800"
        data-testid="spm-back"
      >
        <ArrowLeft class="h-4 w-4" aria-hidden="true" />
        Kembali ke Mod SPM
      </RouterLink>

      <div class="mb-5 sm:mb-8">
        <h1
          class="flex items-center gap-2 font-heading text-2xl font-extrabold text-slate-800 sm:text-3xl"
          data-testid="spm-heading"
        >
          <Database class="h-6 w-6 shrink-0 text-indigo-600 sm:h-7 sm:w-7" aria-hidden="true" />
          Databank Soalan SPM
        </h1>
        <p class="mt-1 text-sm text-slate-600 sm:text-base" data-testid="spm-sub">
          Pilih subjek dan mula jawab dari bank soalan
        </p>
      </div>

      <div
        v-if="data"
        class="grid grid-cols-1 gap-3 sm:gap-5 md:grid-cols-2 lg:grid-cols-3"
        data-testid="databank-grid"
      >
        <div
          v-for="s in data"
          :key="s.code"
          class="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5"
          :data-testid="`databank-card-${s.code}`"
        >
          <div class="mb-3 flex items-center gap-3">
            <div
              class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl"
              :style="{ background: `${s.color}22`, color: s.color }"
              data-testid="databank-icon"
            >
              <SubjectIcon :icon="s.icon" class="h-6 w-6" />
            </div>
            <div class="min-w-0">
              <h2
                class="font-heading text-base font-extrabold break-words text-slate-800"
                data-testid="databank-name"
              >
                {{ s.name }}
              </h2>
              <p class="text-xs text-slate-500" data-testid="databank-name-en">{{ s.nameEn }}</p>
            </div>
          </div>
          <p class="mb-3 text-sm text-slate-600" data-testid="databank-count">
            {{ formatCount(s.databankCount) }} soalan dalam databank
          </p>
          <div class="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
            <span class="text-sm font-medium text-slate-500">Pilih set:</span>
            <RouterLink
              v-for="n in COUNTS"
              :key="n"
              :to="`/spm/tahun-lepas/${encodeURIComponent(s.code)}/quiz?count=${String(n)}`"
              class="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-700 transition hover:border-amber-400 hover:bg-amber-50"
              :data-testid="`databank-set-${s.code}-${String(n)}`"
            >
              {{ n }}
            </RouterLink>
            <span class="ml-auto text-sm font-bold text-amber-600" data-testid="databank-mula"
              >Mula</span
            >
          </div>
        </div>
      </div>
      <LoadError v-else-if="error" @retry="reload()" />
      <SkeletonCards v-else />
    </div>
  </div>
</template>
