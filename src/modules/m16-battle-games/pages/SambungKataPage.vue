<script setup lang="ts">
/**
 * S22 `/permainan/sambung-kata` (FR-M16-104, DV-M16-03): live answers an empty HTTP 500; the rebuild
 * renders the app's handled 500 page (standalone, no shell, as the S28 500 page of the live
 * inventory): "500", "⚙️", "Ralat Pelayan", the message, "Halaman Utama" and "Cuba Semula" (reloads).
 * No game is built (content not observable, Q-M16-8).
 */
import { DsErrorPage, DsText } from '@/ds'
import { SERVER_ERROR_COPY as COPY } from '../components/competition/copy'

function reload(): void {
  window.location.reload()
}
</script>

<template>
  <main
    class="flex min-h-screen flex-col items-center justify-center px-4"
    data-page="server-error"
    data-testid="m16-server-error"
  >
    <DsErrorPage :code="500" :title="COPY.heading" :description="COPY.message">
      <template #actions>
        <UButton
          to="/"
          size="xl"
          color="primary"
          variant="solid"
          class="min-h-12 justify-center"
          data-testid="m16-error-home"
        >
          {{ COPY.home }}
        </UButton>
        <UButton
          type="button"
          size="xl"
          color="neutral"
          variant="soft"
          class="min-h-12 justify-center"
          data-testid="m16-error-retry"
          @click="reload"
        >
          {{ COPY.retry }}
        </UButton>
      </template>
    </DsErrorPage>
    <DsText variant="overline" as="p" align="center">{{ COPY.emoji }} {{ COPY.caption }}</DsText>
  </main>
</template>
