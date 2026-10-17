<script setup lang="ts">
/**
 * S33 `/kelas-saya` "Kelas Saya", student (M10-T7; FR-M10-38, FR-M10-39). The join card
 * (FN-M10-3.4.1) sits above either the empty card (FN-M10-3.4.2, observed) or one PROPOSED card per
 * joined class (FN-M10-3.4.3). `?kod=` pre-fills the code and never joins by itself (BR-M10-02).
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { useApi } from '@/composables'
import { DsEmptyState, DsPage } from '@/ds'

import { fetchJoinedClasses } from '../api/guru'
import { KELAS_COPY } from '../components/kelas-saya/copy'
import JoinClassForm from '../components/kelas-saya/JoinClassForm.vue'
import JoinedClassCard from '../components/kelas-saya/JoinedClassCard.vue'

const route = useRoute()
const kod = computed(() => {
  const raw = route.query.kod
  const value = Array.isArray(raw) ? raw[0] : raw
  return typeof value === 'string' ? value : ''
})

const { data, error, loading, reload } = useApi((signal) => fetchJoinedClasses({ signal }))
</script>

<template>
  <DsPage data-testid="kelas-saya-page">
    <JoinClassForm :initial-code="kod" @joined="reload" />

    <div v-if="error" class="flex max-w-xl min-w-0 flex-col gap-3" data-testid="classes-error">
      <UAlert
        color="error"
        variant="soft"
        icon="i-ph-warning-circle-duotone"
        :title="KELAS_COPY.loadFailed"
      />
      <UButton size="lg" class="min-h-11 self-start" data-testid="classes-retry" @click="reload">{{
        KELAS_COPY.retry
      }}</UButton>
    </div>

    <div
      v-else-if="loading && !data"
      class="flex justify-center py-8 text-muted"
      data-testid="classes-loading"
    >
      <UProgress animation="carousel" class="w-full max-w-xs" aria-label="Memuatkan" />
    </div>

    <UCard v-else-if="data && data.data.length === 0" data-testid="classes-empty">
      <DsEmptyState
        :title="KELAS_COPY.emptyTitle"
        :description="KELAS_COPY.emptyText"
        icon="i-ph-chalkboard-teacher-duotone"
      />
    </UCard>

    <ul
      v-else-if="data"
      class="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2"
      data-testid="classes-list"
    >
      <JoinedClassCard v-for="item in data.data" :key="item.id" :item="item" />
    </ul>
  </DsPage>
</template>
