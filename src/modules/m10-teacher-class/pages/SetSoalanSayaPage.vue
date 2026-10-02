<script setup lang="ts">
/**
 * S34 `/set-soalan-saya` "Set Soalan Guru", student (M10-T7b; FR-M10-73, FN-M10-5.7.1/5.7.2).
 * Empty: the observed card "Tiada Set Soalan". Populated rows are PROPOSED; "Mula" opens the M05
 * quiz `/set-soalan-saya/:id/jawab`.
 */
import { ClipboardList } from '@lucide/vue'

import { AlertBox, LoadingSpinner } from '@/components/feedback'
import { useApi } from '@/composables'

import { fetchMyQuestionSets } from '../api/guru'
import { SET_COPY } from '../components/set-soalan-saya/copy'
import QuestionSetRow from '../components/set-soalan-saya/QuestionSetRow.vue'

const { data, error, loading, reload } = useApi((signal) => fetchMyQuestionSets({ signal }))
</script>

<template>
  <div class="min-w-0 space-y-4" data-testid="set-soalan-page">
    <div
      v-if="error"
      class="min-w-0 space-y-3 rounded-2xl bg-white p-4 shadow-sm"
      data-testid="sets-error"
    >
      <AlertBox :messages="SET_COPY.loadFailed" />
      <button
        type="button"
        class="inline-flex min-h-11 items-center rounded-xl bg-slate-900 px-4 text-sm font-bold text-white hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
        data-testid="sets-retry"
        @click="reload"
      >
        {{ SET_COPY.retry }}
      </button>
    </div>

    <div
      v-else-if="loading && !data"
      class="flex justify-center rounded-2xl bg-white px-4 py-10 text-slate-400 shadow-sm"
      data-testid="sets-loading"
    >
      <LoadingSpinner :size="24" />
    </div>

    <section
      v-else-if="data && data.data.length === 0"
      class="rounded-2xl bg-white px-4 py-10 text-center shadow-sm"
      data-testid="sets-empty"
    >
      <span
        class="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-indigo-100 text-indigo-500"
      >
        <ClipboardList class="h-9 w-9" />
      </span>
      <h3 class="mt-4 font-heading text-lg font-bold text-slate-800">{{ SET_COPY.emptyTitle }}</h3>
      <p class="mt-1 text-slate-500">{{ SET_COPY.emptyText }}</p>
    </section>

    <ul v-else-if="data" class="grid min-w-0 grid-cols-1 gap-3" data-testid="sets-list">
      <QuestionSetRow v-for="item in data.data" :key="item.id" :item="item" />
    </ul>
  </div>
</template>
