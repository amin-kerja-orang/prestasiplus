<script setup lang="ts">
/**
 * S7 `/cabutan` (FR-M15-54..56; URS FT-M15-7.1): header card with the syiling tile, "Cabutan Dibuka"
 * and, with no open draw, the dashed empty box. One PROPOSED card per open draw with the ticket
 * purchase (#13, M14 `draws.buyTicket`). No closed-draw or winner section exists.
 */
import { computed, ref } from 'vue'

import { useApi, useFlash } from '@/composables'
import { DsArt3D, DsEmptyState, DsPage, DsRewardChip, DsLoadError } from '@/ds'

import { buyCabutanTicket, fetchCabutan } from '../api'
import { DRAW_COPY } from '../components/copy'
import DrawCard from '../components/DrawCard.vue'
import { errorMessage } from '../components/format'
import LoadSkeleton from '../components/LoadSkeleton.vue'
import { COMMON_COPY } from '../components/copy'

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
  <DsPage data-testid="m15-cabutan-page">
    <UCard data-testid="cabutan-hero">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div class="flex min-w-0 items-center gap-3">
          <DsArt3D name="party" size="xl" float />
          <div class="flex min-w-0 flex-col gap-1">
            <h1 class="text-title text-highlighted" data-testid="cabutan-title">
              {{ DRAW_COPY.heading }}
            </h1>
            <p class="text-body text-muted">{{ DRAW_COPY.sub }}</p>
          </div>
        </div>
        <div class="flex shrink-0 flex-col items-start gap-1" data-testid="cabutan-tile">
          <p class="text-caption text-muted">{{ DRAW_COPY.tileLabel }}</p>
          <DsRewardChip :value="balance ?? '…'" art="coin" data-testid="cabutan-balance" />
        </div>
      </div>
    </UCard>

    <section class="flex flex-col gap-3">
      <h2 class="text-heading text-highlighted">{{ DRAW_COPY.openHeading }}</h2>

      <DsLoadError v-if="view.error.value" :message="COMMON_COPY.loadFailed" testid="m15-load-error" retry-testid="m15-retry" @retry="view.reload()" />
      <LoadSkeleton v-else-if="!view.data.value" testid="cabutan-loading" />
      <div v-else-if="draws.length === 0" data-testid="cabutan-empty">
        <DsEmptyState :title="DRAW_COPY.empty" icon="ticket" />
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
  </DsPage>
</template>
