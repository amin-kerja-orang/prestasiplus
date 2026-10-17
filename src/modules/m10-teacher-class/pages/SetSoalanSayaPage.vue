<script setup lang="ts">
/**
 * S34 `/set-soalan-saya` "Set Soalan Guru", student (M10-T7b; FR-M10-73, FN-M10-5.7.1/5.7.2).
 * Empty: the observed card "Tiada Set Soalan". Populated rows are PROPOSED; "Mula" opens the M05
 * quiz `/set-soalan-saya/:id/jawab`.
 */
import { useApi } from '@/composables'
import { DsEmptyState, DsPage } from '@/ds'

import { fetchMyQuestionSets } from '../api/guru'
import { SET_COPY } from '../components/set-soalan-saya/copy'
import QuestionSetRow from '../components/set-soalan-saya/QuestionSetRow.vue'

const { data, error, loading, reload } = useApi((signal) => fetchMyQuestionSets({ signal }))
</script>

<template>
  <DsPage data-testid="set-soalan-page">
    <div v-if="error" class="flex max-w-xl min-w-0 flex-col gap-3" data-testid="sets-error">
      <UAlert
        color="error"
        variant="soft"
        icon="i-ph-warning-circle-duotone"
        :title="SET_COPY.loadFailed"
      />
      <UButton size="lg" class="min-h-11 self-start" data-testid="sets-retry" @click="reload">{{
        SET_COPY.retry
      }}</UButton>
    </div>

    <div
      v-else-if="loading && !data"
      class="flex justify-center py-8 text-muted"
      data-testid="sets-loading"
    >
      <UProgress animation="carousel" class="w-full max-w-xs" aria-label="Memuatkan" />
    </div>

    <UCard v-else-if="data && data.data.length === 0" data-testid="sets-empty">
      <DsEmptyState
        :title="SET_COPY.emptyTitle"
        :description="SET_COPY.emptyText"
        icon="i-ph-clipboard-text-duotone"
      />
    </UCard>

    <ul v-else-if="data" class="grid min-w-0 grid-cols-1 gap-3" data-testid="sets-list">
      <QuestionSetRow v-for="item in data.data" :key="item.id" :item="item" />
    </ul>
  </DsPage>
</template>
