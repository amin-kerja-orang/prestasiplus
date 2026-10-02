<script setup lang="ts">
/**
 * S4 `/prestasi/kelas` "Pilih Kelas" (M08-T5; FR-M08-29, FR-M08-30). The viewer's own active classes;
 * none (the admin, a pelajar) shows the observed empty state. The populated picker reuses the S10 card
 * pattern (PROPOSED, UNVERIFIED L-6); the card action "Lihat Prestasi" is INFERRED.
 */
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import { AlertBox } from '@/components/feedback'

import { fetchOwnClasses } from '../api/performance'
import ClassPickCard from '../components/prestasi/ClassPickCard.vue'
import { LOAD_ERROR, isLoadError, useRouteData } from '../lib/prestasi/load'

const { data, error, reload } = useRouteData((signal) => fetchOwnClasses({ signal }))
const loadFailed = computed(() => isLoadError(error.value))
const active = computed(() => (data.value ?? []).filter((c) => c.isActive))
</script>

<template>
  <div class="min-w-0 space-y-5" data-testid="prestasi-kelas-pilih-page">
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
      <header class="flex items-center gap-3 rounded-2xl bg-white p-4 shadow">
        <span
          class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-2xl"
          >📊</span
        >
        <div class="min-w-0">
          <h1 class="text-lg font-bold text-slate-800">Dashboard Kelas</h1>
          <p class="text-sm text-slate-500">Pilih kelas untuk lihat prestasi keseluruhan</p>
        </div>
      </header>

      <section
        v-if="active.length === 0"
        class="rounded-2xl bg-white p-8 text-center shadow"
        data-testid="kelas-empty"
      >
        <p class="text-5xl">📭</p>
        <h3 class="mt-3 text-lg font-bold text-slate-800">Anda belum mempunyai kelas aktif.</h3>
        <p class="mt-1 text-sm text-slate-500">
          Cipta kelas terlebih dahulu untuk mula memantau prestasi murid.
        </p>
        <RouterLink
          to="/guru/kelas/cipta"
          class="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white shadow transition hover:bg-indigo-700"
          data-testid="kelas-create"
          >Cipta Kelas</RouterLink
        >
      </section>

      <div
        v-else
        class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        data-testid="kelas-list"
      >
        <ClassPickCard
          v-for="c in active"
          :key="c.id"
          :item="c"
          :to="`/prestasi/kelas/${c.id}`"
          action="Lihat Prestasi"
        />
      </div>
    </template>
  </div>
</template>
