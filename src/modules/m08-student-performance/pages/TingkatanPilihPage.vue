<script setup lang="ts">
/** S2 `/prestasi/tingkatan` "Pilih Tingkatan" (M08-T5; FR-M08-22): two link cards, only T4 and T5 exist. */
import { GraduationCap } from '@lucide/vue'
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import { AlertBox } from '@/components/feedback'

import { fetchLevels } from '../api/performance'
import { levelNumber, plain } from '../lib/prestasi/format'
import { LOAD_ERROR, isLoadError, useRouteData } from '../lib/prestasi/load'

const { data, error, reload } = useRouteData((signal) => fetchLevels({ signal }))
const loadFailed = computed(() => isLoadError(error.value))
</script>

<template>
  <div class="min-w-0" data-testid="tingkatan-pilih-page">
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
    <div v-else-if="data" class="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <RouterLink
        v-for="l in data"
        :key="l.code"
        :to="`/prestasi/tingkatan/${l.code}`"
        class="flex min-h-11 items-center gap-4 rounded-2xl bg-white p-5 shadow transition hover:shadow-md"
        :data-testid="`level-link-${l.code}`"
      >
        <span
          class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"
        >
          <GraduationCap class="h-6 w-6" />
        </span>
        <span class="min-w-0">
          <h3 class="text-lg font-bold text-slate-800">Tingkatan {{ levelNumber(l.code) }}</h3>
          <span class="text-sm text-slate-500"
            >{{ plain(l.classes) }} kelas | {{ plain(l.students) }} murid</span
          >
        </span>
      </RouterLink>
    </div>
  </div>
</template>
