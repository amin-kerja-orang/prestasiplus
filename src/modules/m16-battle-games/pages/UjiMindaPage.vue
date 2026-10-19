<script setup lang="ts">
/**
 * S21 `/permainan/uji-minda` (FR-M16-103; URS FN-M16-7.4.1): the empty state (no challenge set by a
 * parent; #41 returns `{challenge: null}`), laid out as the live capture (`uji-minda.png`): a centred
 * pink back link, the brain emoji, a plain dark heading, and a white card with a pink list box. The
 * populated student view and the parent side belong to the parent-portal owner (out of scope,
 * OQ-M16-12).
 */
import { useApi } from '@/composables'
import { DsArt3D, DsPage, DsLoadError, DsBackLink } from '@/ds'

import { fetchUjiMinda } from '../api'
import { BACK_LINK, UJI_MINDA_COPY as COPY } from '../components/competition/copy'
import { LOAD_COPY } from '../components/competition/copy'

const view = useApi((signal) => fetchUjiMinda({ signal }))
</script>

<template>
  <DsPage data-testid="m16-uji-minda-page">
    <DsBackLink :to="BACK_LINK.to" :label="BACK_LINK.label" data-testid="m16-back-link" />

    <DsLoadError v-if="view.error.value" :message="LOAD_COPY.failed" testid="m16-load-error" retry-testid="m16-retry" @retry="view.reload()" />
    <div
      v-else-if="!view.data.value"
      class="flex flex-col gap-3"
      aria-busy="true"
      data-testid="uji-minda-loading"
    >
      <USkeleton class="h-16 w-full" />
      <USkeleton class="h-16 w-full" />
    </div>
    <div v-else class="mx-auto flex w-full max-w-xl flex-col gap-4 text-center">
      <header class="flex flex-col items-center gap-2" data-testid="uji-minda-hero">
        <DsArt3D name="books" size="hero" float />
        <div class="text-title" aria-hidden="true">{{ COPY.emoji }}</div>
        <h1 class="text-title text-highlighted">{{ COPY.heading }}</h1>
        <p class="mx-auto max-w-md text-body text-muted">{{ COPY.sub }}</p>
      </header>

      <UCard class="mx-auto w-full max-w-sm text-start" data-testid="uji-minda-how">
        <p class="text-body text-muted">
          <strong class="text-highlighted">{{ COPY.howTitle }}</strong
          ><br />
          {{ COPY.howBefore }} <strong class="text-highlighted">{{ COPY.howLink }}</strong>
          {{ COPY.howAfter }}
        </p>
        <div class="mt-4 bg-elevated p-4">
          <p class="text-caption text-highlighted">{{ COPY.setHeading }}</p>
          <ul class="mt-2 flex flex-col gap-1 text-caption text-muted" data-testid="uji-minda-list">
            <li v-for="item in COPY.setItems" :key="item">{{ item }}</li>
          </ul>
        </div>
      </UCard>
    </div>
  </DsPage>
</template>
