<script setup lang="ts">
/**
 * S22 `/permainan/sambung-kata` (FR-M16-104, DV-M16-03): live answers an empty HTTP 500; the rebuild
 * renders the app's handled 500 page (standalone, no shell, as the S28 500 page of the live
 * inventory): "500", "⚙️", "Ralat Pelayan", the message, "Halaman Utama" and "Cuba Semula" (reloads).
 * No game is built (content not observable, Q-M16-8).
 */
import { RouterLink } from 'vue-router'

import { SERVER_ERROR_COPY as COPY } from '../components/competition/copy'

function reload(): void {
  window.location.reload()
}
</script>

<template>
  <main
    class="flex min-h-screen items-center justify-center px-4 py-8 font-sans bg-error-page"
    data-page="server-error"
    data-testid="m16-server-error"
  >
    <div class="text-center">
      <div class="text-9xl leading-none font-black text-white/30">{{ COPY.code }}</div>
      <div class="-mt-1 mb-6 text-[4rem] leading-none">{{ COPY.emoji }}</div>
      <h1 class="mb-2 font-sans text-2xl font-bold text-white">{{ COPY.heading }}</h1>
      <p class="mx-auto mb-9 max-w-md text-[15px] leading-[1.65] text-white/80">
        {{ COPY.message }}
      </p>
      <div class="flex flex-wrap justify-center gap-3">
        <RouterLink
          to="/"
          class="inline-flex min-h-11 items-center justify-center rounded-full border border-white bg-white px-8 py-3 leading-[normal] font-semibold text-violet-600"
          data-testid="m16-error-home"
        >
          {{ COPY.home }}
        </RouterLink>
        <button
          type="button"
          class="inline-flex min-h-11 items-center justify-center rounded-full border border-white/30 bg-white/20 px-8 py-3 leading-[normal] font-semibold text-white"
          data-testid="m16-error-retry"
          @click="reload"
        >
          {{ COPY.retry }}
        </button>
      </div>
      <div class="mt-12 text-xs font-semibold tracking-[0.2em] text-white/60">
        {{ COPY.caption }}
      </div>
    </div>
  </main>
</template>
