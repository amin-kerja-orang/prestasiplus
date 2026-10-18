<script setup lang="ts">
/**
 * S10 `/analisa-item/kelas` "Pilih Kelas untuk Analisis" (M08-T5; FR-M08-62, FR-M08-63): one card per
 * class the viewer may open, in the BR-M08-30 order the API gives. Admin and teacher only; every other
 * role gets the 403 page from the route guard.
 */
import { computed } from 'vue'

import { DsBreadcrumb, DsLoadError, DsPage, DsPageHeader } from '@/ds'
import { usePrototypeScope } from '@/composables'

import { fetchItemAnalysisClasses } from '../api/performance'
import ClassPickCard from '../components/prestasi/ClassPickCard.vue'
import { isLoadError, useRouteData, LOAD_ERROR } from '../lib/prestasi/load'

const { home } = usePrototypeScope()
const { data, error, reload } = useRouteData((signal) => fetchItemAnalysisClasses({ signal }))
const loadFailed = computed(() => isLoadError(error.value))
</script>

<template>
  <DsPage data-testid="analisa-item-kelas-pilih-page">
    <DsLoadError v-if="loadFailed" :message="LOAD_ERROR" testid="page-error" @retry="reload()" />

    <template v-else-if="data">
      <DsBreadcrumb
        :items="[{ label: 'Papan Pemuka', to: home }, { label: 'Pilih Kelas' }]"
        aria-label="Breadcrumb"
        data-testid="breadcrumb"
      />

      <DsPageHeader
        title="Pilih Kelas untuk Analisis"
        subtitle="Klik mana-mana kelas untuk melihat analisa item"
      />

      <div
        class="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 xl:grid-cols-3"
        data-testid="class-grid"
      >
        <ClassPickCard
          v-for="c in data"
          :key="c.id"
          :item="c"
          :to="`/analisa-item/kelas/${c.id}`"
          action="Lihat Analisa"
        />
      </div>
    </template>
    <div v-else-if="!error" class="flex flex-col gap-4 md:gap-6" aria-busy="true" data-testid="page-loading">
      <USkeleton class="h-24 w-full" />
      <USkeleton class="h-64 w-full" />
    </div>
  </DsPage>
</template>
