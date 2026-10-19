<script setup lang="ts">
/**
 * S7 `/cabutan` (FR-M15-54..56; URS FT-M15-7.1): header card with the syiling tile, "Cabutan Dibuka"
 * and, with no open draw, the dashed empty box. One PROPOSED card per open draw with the ticket
 * purchase (#13, M14 `draws.buyTicket`). No closed-draw or winner section exists.
 */
import { computed, ref } from 'vue'

import { useApi, useFlash } from '@/composables'
import {
  DsArt3D,
  DsEmptyState,
  DsPage,
  DsRewardChip,
  DsLoadError,
  DsCluster,
  DsStack,
  DsHeading,
  DsText,
} from '@/ds'

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
      <DsCluster gap="md" justify="between">
        <DsCluster :wrap="false">
          <DsArt3D name="party" size="xl" float />
          <DsStack gap="2xs">
            <DsHeading :level="1" data-testid="cabutan-title">
              {{ DRAW_COPY.heading }}
            </DsHeading>
            <DsText variant="body" tone="muted">{{ DRAW_COPY.sub }}</DsText>
          </DsStack>
        </DsCluster>
        <DsStack gap="2xs" align="start" class="shrink-0" data-testid="cabutan-tile">
          <DsText variant="caption">{{ DRAW_COPY.tileLabel }}</DsText>
          <DsRewardChip :value="balance ?? '…'" art="coin" data-testid="cabutan-balance" />
        </DsStack>
      </DsCluster>
    </UCard>

    <DsStack as="section" gap="sm">
      <DsHeading :level="2">{{ DRAW_COPY.openHeading }}</DsHeading>

      <DsLoadError
        v-if="view.error.value"
        :message="COMMON_COPY.loadFailed"
        testid="m15-load-error"
        retry-testid="m15-retry"
        @retry="view.reload()"
      />
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
    </DsStack>
  </DsPage>
</template>
