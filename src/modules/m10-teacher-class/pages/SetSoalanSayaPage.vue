<script setup lang="ts">
/**
 * S34 `/set-soalan-saya` "Set Soalan Guru", student (M10-T7b; FR-M10-73, FN-M10-5.7.1/5.7.2).
 * Empty: the observed card "Tiada Set Soalan". Populated rows are PROPOSED; "Mula" opens the M05
 * quiz `/set-soalan-saya/:id/jawab`.
 */
import { useApi } from '@/composables'
import { DsEmptyState, DsPage, DsPanel, DsLoadError } from '@/ds'

import { fetchMyQuestionSets } from '../api/guru'
import { SET_COPY } from '../components/set-soalan-saya/copy'
import QuestionSetRow from '../components/set-soalan-saya/QuestionSetRow.vue'

const { data, error, loading, reload } = useApi((signal) => fetchMyQuestionSets({ signal }))
</script>

<template>
  <DsPage data-testid="set-soalan-page">
    <DsLoadError
      v-if="error"
      :message="SET_COPY.loadFailed"
      :retry-label="SET_COPY.retry"
      class="max-w-xl"
      testid="sets-error"
      @retry="reload"
    />

    <div
      v-else-if="loading && !data"
      class="flex justify-center py-8 text-muted"
      data-testid="sets-loading"
    >
      <UProgress animation="carousel" class="w-full max-w-xs" aria-label="Memuatkan" />
    </div>

    <DsPanel v-else-if="data && data.data.length === 0" data-testid="sets-empty">
      <DsEmptyState
        :title="SET_COPY.emptyTitle"
        :description="SET_COPY.emptyText"
        icon="i-ph-clipboard-text-duotone"
      />
    </DsPanel>

    <ul v-else-if="data" class="grid min-w-0 grid-cols-1 gap-3" data-testid="sets-list">
      <QuestionSetRow v-for="item in data.data" :key="item.id" :item="item" />
    </ul>
  </DsPage>
</template>
