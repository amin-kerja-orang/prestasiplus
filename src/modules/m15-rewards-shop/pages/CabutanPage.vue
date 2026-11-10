<script setup lang="ts">
/**
 * S7 `/cabutan` (FR-M15-54..56; URS FT-M15-7.1): header card with the syiling tile, "Cabutan Dibuka"
 * and, with no open draw, the dashed empty box. One PROPOSED card per open draw with the ticket
 * purchase (#13, M14 `draws.buyTicket`): "Beli Tiket" opens the confirm dialog (B-056a, focus on "Batal"),
 * the confirmed press sends one `clientUuid` (DM-78), a refusal shows the server's BM text, and
 * "Keputusan Cabutan" lists the newest drawn draws (FR-MUR-22-3).
 */
import { computed, nextTick, ref, watch } from 'vue'

import { ApiError } from '@/api'
import { useApi, useFlash } from '@/composables'
import { DsArt3D, DsDialog, DsEmptyState, DsHeading, DsLoadError, DsPage, DsRewardChip, DsStack, DsText } from '@/ds'

import { buyCabutanTicket, fetchCabutan, type OpenDrawView } from '../api'
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
const results = computed(() => view.data.value?.results ?? [])

/** The draw awaiting the pupil's confirmation, and the key of this one press (a double press repeats it). */
const pending = ref<OpenDrawView | null>(null)
const pressKey = ref('')
const cancelButton = ref<{ $el?: HTMLElement } | null>(null)

function ask(drawId: number): void {
  const draw = draws.value.find((d) => d.id === drawId)
  if (!draw || busy.value) return
  pressKey.value = globalThis.crypto.randomUUID()
  pending.value = draw
}

function closeDialog(open: boolean): void {
  if (!open && !busy.value) pending.value = null
}

// "Batal" is the safe default focus (B-056a); the dialog moves focus on open, so this runs after it.
watch(pending, async (draw) => {
  if (!draw) return
  await nextTick()
  setTimeout(() => cancelButton.value?.$el?.focus(), 0)
})

async function buy(): Promise<void> {
  const draw = pending.value
  if (!draw || busy.value) return
  busy.value = true
  try {
    await buyCabutanTicket(draw.id, pressKey.value)
  } catch (e) {
    // A refusal (409) carries the exact BM text; anything else keeps the shared convention.
    const refused = e instanceof ApiError && e.status === 409 && e.message !== ''
    flash.show({ type: 'error', message: refused ? e.message : errorMessage() })
  } finally {
    pending.value = null
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
          @buy="ask"
        />
      </div>
    </section>

    <DsStack v-if="results.length > 0" as="section" gap="sm" data-testid="cabutan-results">
      <DsHeading :level="2">{{ DRAW_COPY.resultsHeading }}</DsHeading>
      <DsStack gap="md">
        <UCard v-for="r in results" :key="r.id" :data-testid="`result-${String(r.id)}`">
          <DsStack as="article" gap="xs">
            <DsHeading :level="3" wrap="anywhere">{{ r.title }}</DsHeading>
            <DsStack as="ul" gap="2xs">
              <DsText
                v-for="(w, i) in r.winners"
                :key="i"
                as="li"
                variant="body"
                tone="default"
                wrap="anywhere"
                data-testid="result-winner"
              >
                {{ w.prize }}:
                <DsText v-if="w.isYou" as="strong" variant="body-strong" tone="highlighted" data-testid="result-you">
                  {{ DRAW_COPY.youWon }}
                </DsText>
                <template v-else>{{ w.name }}</template>
              </DsText>
            </DsStack>
          </DsStack>
        </UCard>
      </DsStack>
    </DsStack>

    <DsDialog
      :open="pending !== null"
      :title="DRAW_COPY.confirmTitle"
      :loading="busy"
      size="sm"
      @update:open="closeDialog"
    >
      <DsText v-if="pending" variant="body" tone="default" data-testid="draw-confirm-body">
        {{ DRAW_COPY.confirmBody(pending.ticketCostSyiling, view.data.value?.syilingBalance ?? 0) }}
      </DsText>
      <template #footer>
        <UButton
          ref="cancelButton"
          size="xl"
          color="neutral"
          variant="ghost"
          class="min-h-14"
          :disabled="busy"
          data-testid="draw-confirm-cancel"
          @click="closeDialog(false)"
        >
          {{ DRAW_COPY.confirmCancel }}
        </UButton>
        <UButton
          size="xl"
          class="min-h-14"
          :loading="busy"
          data-testid="draw-confirm-buy"
          @click="buy"
        >
          {{ DRAW_COPY.confirmBuy }}
        </UButton>
      </template>
    </DsDialog>
  </DsPage>
</template>
