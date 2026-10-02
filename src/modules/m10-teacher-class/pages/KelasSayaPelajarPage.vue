<script setup lang="ts">
/**
 * S33 `/kelas-saya` "Kelas Saya", student (M10-T7; FR-M10-38, FR-M10-39). The join card
 * (FN-M10-3.4.1) sits above either the empty card (FN-M10-3.4.2, observed) or one PROPOSED card per
 * joined class (FN-M10-3.4.3). `?kod=` pre-fills the code and never joins by itself (BR-M10-02).
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { AlertBox, LoadingSpinner } from '@/components/feedback'
import { useApi } from '@/composables'

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
  <div class="min-w-0 space-y-4" data-testid="kelas-saya-page">
    <JoinClassForm :initial-code="kod" @joined="reload" />

    <div
      v-if="error"
      class="min-w-0 space-y-3 rounded-2xl bg-white p-4 shadow-sm"
      data-testid="classes-error"
    >
      <AlertBox :messages="KELAS_COPY.loadFailed" />
      <button
        type="button"
        class="inline-flex min-h-11 items-center rounded-xl bg-slate-900 px-4 text-sm font-bold text-white hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
        data-testid="classes-retry"
        @click="reload"
      >
        {{ KELAS_COPY.retry }}
      </button>
    </div>

    <div
      v-else-if="loading && !data"
      class="flex justify-center rounded-2xl bg-white px-4 py-10 text-slate-400 shadow-sm"
      data-testid="classes-loading"
    >
      <LoadingSpinner :size="24" />
    </div>

    <section
      v-else-if="data && data.data.length === 0"
      class="rounded-2xl bg-white px-4 py-10 text-center shadow-sm"
      data-testid="classes-empty"
    >
      <p class="text-5xl">📚</p>
      <h3 class="mt-3 font-heading text-lg font-bold text-slate-800">
        {{ KELAS_COPY.emptyTitle }}
      </h3>
      <p class="mt-1 text-slate-500">{{ KELAS_COPY.emptyText }}</p>
    </section>

    <ul v-else-if="data" class="grid min-w-0 grid-cols-1 gap-3" data-testid="classes-list">
      <JoinedClassCard v-for="item in data.data" :key="item.id" :item="item" />
    </ul>
  </div>
</template>
