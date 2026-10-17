<script setup lang="ts">
/**
 * S10 `/analisa-item/kelas` "Pilih Kelas untuk Analisis" (M08-T5; FR-M08-62, FR-M08-63): one card per
 * class the viewer may open, in the BR-M08-30 order the API gives. Admin and teacher only; every other
 * role gets the 403 page from the route guard.
 */
import { computed } from 'vue'

import { DsPage } from '@/ds'
import { usePrototypeScope } from '@/composables'

import { fetchItemAnalysisClasses } from '../api/performance'
import ClassPickCard from '../components/prestasi/ClassPickCard.vue'
import PageHeader from '../components/shared/PageHeader.vue'
import PageLoadError from '../components/shared/PageLoadError.vue'
import PageSkeleton from '../components/shared/PageSkeleton.vue'
import { usePhIcon } from '../lib/icons'
import { isLoadError, useRouteData } from '../lib/prestasi/load'

const { home } = usePrototypeScope()
const icon = usePhIcon()
const { data, error, reload } = useRouteData((signal) => fetchItemAnalysisClasses({ signal }))
const loadFailed = computed(() => isLoadError(error.value))
</script>

<template>
  <DsPage data-testid="analisa-item-kelas-pilih-page">
    <PageLoadError v-if="loadFailed" @retry="reload()" />

    <template v-else-if="data">
      <nav aria-label="Breadcrumb" data-testid="breadcrumb">
        <UButton
          :to="home"
          color="neutral"
          variant="ghost"
          size="lg"
          :icon="icon('arrow-left')"
          label="Papan Pemuka"
        />
      </nav>

      <PageHeader
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
    <PageSkeleton v-else-if="!error" />
  </DsPage>
</template>
