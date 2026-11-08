<script setup lang="ts">
/**
 * S6 `/gamification/mystery-box` (FR-MUR-35-*; 48 GAME-23): one card with the heading and the box block (cost, balance,
 * odds table, disclaimer), the confirm dialog (B-056f, default focus on Batal), the result dialog and the history of
 * the last 10 openings, which always shows (with its empty text).
 *
 * One press = one request: the page is locked while a request runs and sends one `clientUuid` per opening, kept for a
 * retry after a network failure and dropped once the server has answered (AC-MUR-35-5).
 */
import { computed, nextTick, ref, shallowRef, watch } from 'vue'

import { ApiError } from '@/api'
import { useApi, useFlash } from '@/composables'
import {
  DsArt3D,
  DsCluster,
  DsDialog,
  DsHeading,
  DsLoadError,
  DsPage,
  DsStack,
  DsText,
} from '@/ds'

import {
  fetchMysteryBoxes,
  openMysteryBox,
  type MysteryBoxesView,
  type MysteryBoxOpened,
} from '../api'
import { BOX_COPY, COMMON_COPY } from '../components/copy'
import { errorMessage, formatDayMonthTime } from '../components/format'
import LoadSkeleton from '../components/LoadSkeleton.vue'
import MysteryBoxCard from '../components/MysteryBoxCard.vue'
import MysteryResultModal from '../components/MysteryResultModal.vue'

const flash = useFlash()
const view = useApi((signal) => fetchMysteryBoxes({ signal }))
const busy = ref(false)
const result = ref<MysteryBoxOpened | null>(null)
/** The latest re-read after an opening; wins over the first load. */
const fresh = shallowRef<MysteryBoxesView | null>(null)
const data = computed(() => fresh.value ?? view.data.value)
const history = computed(() => (data.value?.history ?? []).slice(0, 10))

const confirmOpen = ref(false)
const cancelButton = ref<{ $el?: HTMLElement } | null>(null)
let pendingBoxId = 0
let clientUuid: string | null = null

/** Batal is the safe default: focus it once the dialog has mounted (B-056f). */
watch(confirmOpen, async (open) => {
  if (!open) return
  await nextTick()
  setTimeout(() => cancelButton.value?.$el?.focus(), 0)
})

function ask(boxId: number): void {
  if (busy.value) return
  pendingBoxId = boxId
  confirmOpen.value = true
}

/** Re-reads #10 after an opening; a failed re-read keeps what is on screen. */
async function refresh(): Promise<void> {
  try {
    fresh.value = await fetchMysteryBoxes()
  } catch {
    // The opening itself succeeded or was refused; the previous data stays.
  }
}

async function confirm(): Promise<void> {
  confirmOpen.value = false
  if (busy.value) return
  busy.value = true
  clientUuid ??= crypto.randomUUID()
  try {
    result.value = await openMysteryBox(pendingBoxId, clientUuid)
    clientUuid = null
  } catch (e) {
    if (e instanceof ApiError && e.status >= 400 && e.status < 500) {
      // The server answered: the next press is a new opening.
      clientUuid = null
      flash.show({ type: 'error', message: e.message })
    } else {
      flash.show({ type: 'error', message: errorMessage() })
    }
  }
  await refresh()
  busy.value = false
}
</script>

<template>
  <DsPage data-testid="m15-box-page">
    <UCard data-testid="box-hero">
      <DsStack gap="lg">
        <DsStack gap="sm" align="center">
          <DsArt3D name="party" size="hero" float />
          <DsHeading :level="1" variant="title" align="center" data-testid="box-title">{{
            BOX_COPY.heading
          }}</DsHeading>
          <DsText variant="body" tone="muted" align="center">{{ BOX_COPY.sub }}</DsText>
        </DsStack>

        <DsLoadError
          v-if="view.error.value && !data"
          :message="COMMON_COPY.loadFailed"
          testid="m15-load-error"
          retry-testid="m15-retry"
          @retry="view.reload()"
        />
        <LoadSkeleton v-else-if="!data" testid="box-loading" />
        <MysteryBoxCard v-else :view="data" :busy="busy" @open="ask" />
      </DsStack>
    </UCard>

    <DsStack as="section" gap="sm" data-testid="box-history">
      <DsHeading :level="2" variant="heading">{{ BOX_COPY.historyHeading }}</DsHeading>
      <DsText v-if="data && history.length === 0" variant="body" tone="muted" data-testid="box-history-empty">{{
        BOX_COPY.historyEmpty
      }}</DsText>
      <DsStack v-else-if="history.length > 0" as="ul" gap="xs">
        <li v-for="h in history" :key="h.id" data-testid="box-history-row">
          <DsCluster justify="between" gap="sm">
            <DsText variant="label" tone="highlighted" as="span">{{
              h.prizeLabel ? `Kotak Misteri: ${h.prizeLabel}` : `Kotak Misteri: ${h.boxName}`
            }}</DsText>
            <DsText variant="caption" tone="muted" as="span">{{
              formatDayMonthTime(h.createdAt)
            }}</DsText>
          </DsCluster>
        </li>
      </DsStack>
    </DsStack>

    <DsDialog
      v-model:open="confirmOpen"
      :title="BOX_COPY.confirmTitle"
      :description="BOX_COPY.confirmTitle"
    >
      <DsText variant="body" tone="default" data-testid="box-confirm-body">{{
        BOX_COPY.confirmBody(data?.box?.costSyiling ?? 0, data?.syilingBalance ?? 0)
      }}</DsText>
      <template #footer>
        <UButton
          ref="cancelButton"
          type="button"
          color="neutral"
          variant="ghost"
          size="xl"
          class="min-h-14"
          data-testid="box-confirm-cancel"
          @click="confirmOpen = false"
          >{{ BOX_COPY.cancel }}</UButton
        >
        <UButton
          type="button"
          size="xl"
          class="min-h-14"
          data-testid="box-confirm-ok"
          @click="confirm"
          >{{ BOX_COPY.open }}</UButton
        >
      </template>
    </DsDialog>

    <MysteryResultModal :result="result" @close="result = null" />
  </DsPage>
</template>
