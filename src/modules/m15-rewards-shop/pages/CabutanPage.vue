<script setup lang="ts">
/**
 * S7 `/cabutan` (FR-M15-54..56; URS FT-M15-7.1): header card with the syiling tile, "Cabutan Dibuka"
 * and, with no open draw, the dashed empty box. One PROPOSED card per open draw with the ticket
 * purchase (#13, M14 `draws.buyTicket`). No closed-draw or winner section exists.
 */
import { computed, ref } from 'vue'

import { LoadingSpinner } from '@/components/feedback'
import { useApi, useFlash } from '@/composables'

import { buyCabutanTicket, fetchCabutan } from '../api'
import { DRAW_COPY } from '../components/copy'
import DrawCard from '../components/DrawCard.vue'
import { errorMessage } from '../components/format'
import LoadError from '../components/LoadError.vue'

const flash = useFlash()
const view = useApi((signal) => fetchCabutan({ signal }))
const busy = ref(false)

const balance = computed(() => view.data.value?.syilingBalance ?? null)
const draws = computed(() => view.data.value?.draws ?? [])

async function buy(drawId: number): Promise<void> {
  if (busy.value) return
  busy.value = true
  try {
    await buyCabutanTicket(drawId)
  } catch {
    flash.show({ type: 'error', message: errorMessage() })
  } finally {
    // The tile and "Tiket anda" are re-read: the response carries the same values (FR-M15-56).
    await view.reload()
    busy.value = false
  }
}
</script>

<template>
  <div class="min-w-0 space-y-6" data-testid="m15-cabutan-page">
    <section
      class="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-linear-to-r from-indigo-600 to-fuchsia-600 p-4 text-white shadow-lg sm:p-6"
      data-testid="cabutan-hero"
    >
      <div class="min-w-0">
        <h1 class="text-xl font-bold text-white sm:text-2xl" data-testid="cabutan-title">
          {{ DRAW_COPY.heading }}
        </h1>
        <p class="mt-1 text-sm text-white">{{ DRAW_COPY.sub }}</p>
      </div>
      <div class="shrink-0 rounded-xl bg-white/15 px-4 py-2 text-center" data-testid="cabutan-tile">
        <p class="text-xs text-indigo-100 uppercase">{{ DRAW_COPY.tileLabel }}</p>
        <p class="text-2xl font-bold text-white" data-testid="cabutan-balance">
          {{ balance ?? '…' }} 🪙
        </p>
      </div>
    </section>

    <section class="space-y-3">
      <h2 class="font-heading text-lg font-bold text-slate-800">{{ DRAW_COPY.openHeading }}</h2>

      <LoadError v-if="view.error.value" @retry="view.reload()" />
      <div
        v-else-if="!view.data.value"
        class="flex justify-center py-10 text-slate-400"
        data-testid="cabutan-loading"
      >
        <LoadingSpinner :size="28" />
      </div>
      <div
        v-else-if="draws.length === 0"
        class="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-gray-600"
        data-testid="cabutan-empty"
      >
        {{ DRAW_COPY.empty }}
      </div>
      <div v-else class="grid gap-4" data-testid="cabutan-list">
        <DrawCard
          v-for="d in draws"
          :key="d.id"
          :draw="d"
          :syiling-balance="view.data.value.syilingBalance"
          :busy="busy"
          @buy="buy"
        />
      </div>
    </section>
  </div>
</template>
