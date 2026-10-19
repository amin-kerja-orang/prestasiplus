<script setup lang="ts">
/**
 * S21 `/permainan/uji-minda` (FR-M16-103; URS FN-M16-7.4.1): the empty state (no challenge set by a
 * parent; #41 returns `{challenge: null}`), laid out as the live capture (`uji-minda.png`): a centred
 * pink back link, the brain emoji, a plain dark heading, and a white card with a pink list box. The
 * populated student view and the parent side belong to the parent-portal owner (out of scope,
 * OQ-M16-12).
 */
import { useApi } from '@/composables'
import { DsArt3D, DsPage, DsLoadError, DsBackLink, DsStack, DsText, DsHeading } from '@/ds'

import { fetchUjiMinda } from '../api'
import { BACK_LINK, UJI_MINDA_COPY as COPY } from '../components/competition/copy'
import { LOAD_COPY } from '../components/competition/copy'

const view = useApi((signal) => fetchUjiMinda({ signal }))
</script>

<template>
  <DsPage data-testid="m16-uji-minda-page">
    <DsBackLink :to="BACK_LINK.to" :label="BACK_LINK.label" data-testid="m16-back-link" />

    <DsLoadError
      v-if="view.error.value"
      :message="LOAD_COPY.failed"
      testid="m16-load-error"
      retry-testid="m16-retry"
      @retry="view.reload()"
    />
    <DsStack v-else-if="!view.data.value" gap="sm" aria-busy="true" data-testid="uji-minda-loading">
      <USkeleton class="h-16 w-full" />
      <USkeleton class="h-16 w-full" />
    </DsStack>
    <DsStack v-else class="mx-auto w-full max-w-xl text-center">
      <DsStack as="header" gap="xs" align="center" data-testid="uji-minda-hero">
        <DsArt3D name="books" size="hero" float />
        <DsText variant="title" as="div" aria-hidden="true">{{ COPY.emoji }}</DsText>
        <DsHeading :level="1">{{ COPY.heading }}</DsHeading>
        <DsText variant="body" tone="muted" class="mx-auto max-w-md">{{ COPY.sub }}</DsText>
      </DsStack>

      <UCard class="mx-auto w-full max-w-sm text-start" data-testid="uji-minda-how">
        <DsText variant="body" tone="muted">
          <strong class="text-highlighted">{{ COPY.howTitle }}</strong
          ><br />
          {{ COPY.howBefore }} <strong class="text-highlighted">{{ COPY.howLink }}</strong>
          {{ COPY.howAfter }}
        </DsText>
        <div class="mt-4 bg-elevated p-4">
          <DsText variant="caption" tone="highlighted">{{ COPY.setHeading }}</DsText>
          <ul class="mt-2 flex flex-col gap-1 text-caption text-muted" data-testid="uji-minda-list">
            <li v-for="item in COPY.setItems" :key="item">{{ item }}</li>
          </ul>
        </div>
      </UCard>
    </DsStack>
  </DsPage>
</template>
