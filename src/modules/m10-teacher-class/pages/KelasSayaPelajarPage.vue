<script setup lang="ts">
/**
 * S33 `/kelas-saya` "Kelas Saya", student (R1-MUR-8). The pupil no longer joins a class by code
 * (API-MUR-04, AC-MUR-8-3): the page lists the joined classes or the empty card; `?kod=` is ignored.
 */
import { useApi } from '@/composables'
import { DsEmptyState, DsPage, DsPanel, DsLoadError } from '@/ds'

import { fetchJoinedClasses } from '../api/guru'
import { KELAS_COPY } from '../components/kelas-saya/copy'
import JoinedClassCard from '../components/kelas-saya/JoinedClassCard.vue'

const { data, error, loading, reload } = useApi((signal) => fetchJoinedClasses({ signal }))
</script>

<template>
  <DsPage data-testid="kelas-saya-page">
    <DsLoadError
      v-if="error"
      :message="KELAS_COPY.loadFailed"
      :retry-label="KELAS_COPY.retry"
      class="max-w-xl"
      testid="classes-error"
      @retry="reload"
    />

    <div
      v-else-if="loading && !data"
      class="flex justify-center py-8 text-muted"
      data-testid="classes-loading"
    >
      <UProgress animation="carousel" class="w-full max-w-xs" aria-label="Memuatkan" />
    </div>

    <DsPanel v-else-if="data && data.data.length === 0" data-testid="classes-empty">
      <DsEmptyState
        :title="KELAS_COPY.emptyTitle"
        :description="KELAS_COPY.emptyText"
        icon="chalkboard-teacher"
      />
    </DsPanel>

    <ul
      v-else-if="data"
      class="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2"
      data-testid="classes-list"
    >
      <JoinedClassCard v-for="item in data.data" :key="item.id" :item="item" />
    </ul>
  </DsPage>
</template>
