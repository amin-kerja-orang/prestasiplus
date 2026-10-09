<script setup lang="ts">
/**
 * S21 `/permainan/uji-minda` (FR-M16-103; URS FN-M16-7.4.1): the empty state (no challenge set by a
 * parent; #41 returns `{challenge: null}`). The populated student view and the parent side belong to
 * the parent-portal owner (out of scope, OQ-M16-12).
 */
import { LoadingSpinner } from '@/components/feedback'
import { useApi } from '@/composables'

import { fetchUjiMinda } from '../api'
import BackLink from '../components/competition/BackLink.vue'
import { UJI_MINDA_COPY as COPY } from '../components/competition/copy'
import PageLoadError from '../components/competition/PageLoadError.vue'

const view = useApi((signal) => fetchUjiMinda({ signal }))
</script>

<template>
  <div class="mx-auto max-w-2xl min-w-0 space-y-4" data-testid="m16-uji-minda-page">
    <BackLink />

    <PageLoadError v-if="view.error.value" @retry="view.reload()" />
    <div
      v-else-if="!view.data.value"
      class="flex justify-center py-10 text-slate-400"
      data-testid="uji-minda-loading"
    >
      <LoadingSpinner :size="28" />
    </div>
    <template v-else>
      <section
        class="rounded-2xl bg-linear-to-r from-purple-600 to-indigo-600 p-6 text-center text-white shadow-lg"
        data-testid="uji-minda-hero"
      >
        <div class="text-5xl">{{ COPY.emoji }}</div>
        <h1 class="mt-2 text-2xl font-bold text-white">{{ COPY.heading }}</h1>
        <p class="mt-1 text-sm text-white">{{ COPY.sub }}</p>
      </section>

      <section
        class="rounded-2xl border border-indigo-100 bg-white p-4 text-sm text-slate-700 shadow-sm sm:p-6"
        data-testid="uji-minda-how"
      >
        <p>
          <strong>{{ COPY.howTitle }}</strong>
          {{ COPY.howBefore }} <strong>{{ COPY.howLink }}</strong> {{ COPY.howAfter }}
        </p>
        <div class="mt-4 rounded-xl bg-slate-50 p-4">
          <p class="font-semibold text-slate-800">{{ COPY.setHeading }}</p>
          <ul class="mt-2 space-y-1" data-testid="uji-minda-list">
            <li v-for="item in COPY.setItems" :key="item">{{ item }}</li>
          </ul>
        </div>
      </section>
    </template>
  </div>
</template>
