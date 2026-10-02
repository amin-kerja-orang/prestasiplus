<script setup lang="ts">
/**
 * S10 `/analisa-item/kelas` "Pilih Kelas untuk Analisis" (M08-T5; FR-M08-62, FR-M08-63): one card per
 * class the viewer may open, in the BR-M08-30 order the API gives. Admin and teacher only; every other
 * role gets the 403 page from the route guard.
 */
import { ArrowLeft, Presentation } from '@lucide/vue'
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import { AlertBox } from '@/components/feedback'

import { fetchItemAnalysisClasses } from '../api/performance'
import ClassPickCard from '../components/prestasi/ClassPickCard.vue'
import { LOAD_ERROR, isLoadError, useRouteData } from '../lib/prestasi/load'

const { data, error, reload } = useRouteData((signal) => fetchItemAnalysisClasses({ signal }))
const loadFailed = computed(() => isLoadError(error.value))
</script>

<template>
  <div class="min-w-0 space-y-5" data-testid="analisa-item-kelas-pilih-page">
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
      <nav class="text-sm text-slate-500" data-testid="breadcrumb">
        <RouterLink
          to="/dashboard"
          class="inline-flex min-h-11 items-center gap-1 hover:text-slate-700"
          ><ArrowLeft class="h-4 w-4" />Papan Pemuka</RouterLink
        >
      </nav>

      <header class="flex items-center gap-3 rounded-2xl bg-white p-4 shadow">
        <span
          class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white"
          style="background: linear-gradient(135deg, #6366f1, #4f46e5)"
        >
          <Presentation class="h-6 w-6" />
        </span>
        <div class="min-w-0">
          <h2 class="text-lg font-bold text-slate-800">Pilih Kelas untuk Analisis</h2>
          <p class="text-sm text-slate-500">Klik mana-mana kelas untuk melihat analisa item</p>
        </div>
      </header>

      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="class-grid">
        <ClassPickCard
          v-for="c in data"
          :key="c.id"
          :item="c"
          :to="`/analisa-item/kelas/${c.id}`"
          action="Lihat Analisa"
        />
      </div>
    </template>
  </div>
</template>
