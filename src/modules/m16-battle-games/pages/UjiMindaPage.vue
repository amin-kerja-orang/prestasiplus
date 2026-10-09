<script setup lang="ts">
/**
 * S21 `/permainan/uji-minda` (FR-M16-103; URS FN-M16-7.4.1): the empty state (no challenge set by a
 * parent; #41 returns `{challenge: null}`), laid out as the live capture (`uji-minda.png`): a centred
 * pink back link, the brain emoji, a plain dark heading, and a white card with a pink list box. The
 * populated student view and the parent side belong to the parent-portal owner (out of scope,
 * OQ-M16-12).
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
  <div class="mx-auto max-w-xl min-w-0 space-y-4 text-center" data-testid="m16-uji-minda-page">
    <BackLink tone="pink" />

    <PageLoadError v-if="view.error.value" @retry="view.reload()" />
    <div
      v-else-if="!view.data.value"
      class="flex justify-center py-10 text-slate-400"
      data-testid="uji-minda-loading"
    >
      <LoadingSpinner :size="28" />
    </div>
    <template v-else>
      <header data-testid="uji-minda-hero">
        <div class="text-6xl">{{ COPY.emoji }}</div>
        <h1 class="mt-2 font-heading text-2xl font-bold text-slate-900">{{ COPY.heading }}</h1>
        <p class="mx-auto mt-2 max-w-md text-slate-600">{{ COPY.sub }}</p>
      </header>

      <section
        class="mx-auto max-w-sm rounded-2xl bg-white p-6 text-sm text-slate-700 shadow-sm"
        data-testid="uji-minda-how"
      >
        <p>
          <strong class="text-slate-800">{{ COPY.howTitle }}</strong
          ><br />
          {{ COPY.howBefore }} <strong class="text-slate-800">{{ COPY.howLink }}</strong>
          {{ COPY.howAfter }}
        </p>
        <div class="mt-4 rounded-xl bg-pink-50 p-4 text-left text-pink-700">
          <p class="text-xs font-bold">{{ COPY.setHeading }}</p>
          <ul class="mt-2 space-y-1 text-xs" data-testid="uji-minda-list">
            <li v-for="item in COPY.setItems" :key="item">{{ item }}</li>
          </ul>
        </div>
      </section>
    </template>
  </div>
</template>
