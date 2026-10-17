<script setup lang="ts">
/**
 * S6 `/gamification/mystery-box` (FR-M15-48..53; URS FT-M15-6.1, 6.2): hero with the token chip,
 * four box cards, the PROPOSED opening flow (#11) with its result dialog, and the PROPOSED history
 * card (hidden when the viewer has no opening).
 */
import { computed, ref, shallowRef } from 'vue'

import { useApi, useFlash } from '@/composables'
import { DsArt3D, DsPage, DsRewardChip } from '@/ds'

import {
  fetchMysteryBoxes,
  openMysteryBox,
  type MysteryBoxesView,
  type MysteryBoxOpened,
} from '../api'
import { BOX_COPY } from '../components/copy'
import { errorMessage, formatDayMonthTime } from '../components/format'
import LoadError from '../components/LoadError.vue'
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

const balance = computed(() => data.value?.tokenBalance ?? 0)
const boxes = computed(() => data.value?.boxes ?? [])
const history = computed(() => (data.value?.history ?? []).slice(0, 10))

/**
 * Re-reads #10 after an opening. A failed re-read keeps the data on screen (the opening itself
 * succeeded): the previous boxes and history stay and the balance is the one #11 returned.
 */
async function refresh(tokenBalance: number | null): Promise<void> {
  try {
    fresh.value = await fetchMysteryBoxes()
  } catch {
    const base = fresh.value ?? view.data.value
    if (base && tokenBalance !== null) fresh.value = { ...base, tokenBalance }
  }
}

async function open(boxId: number): Promise<void> {
  if (busy.value) return
  busy.value = true
  let res: MysteryBoxOpened | null = null
  try {
    res = await openMysteryBox(boxId)
    result.value = res
  } catch {
    flash.show({ type: 'error', message: errorMessage() })
  }
  await refresh(res ? res.tokenBalance : null)
  busy.value = false
}
</script>

<template>
  <DsPage data-testid="m15-box-page">
    <UCard data-testid="box-hero">
      <div class="flex flex-col items-center gap-3 text-center">
        <DsArt3D name="party" size="hero" float />
        <h1 class="text-title text-highlighted" data-testid="box-title">{{ BOX_COPY.heading }}</h1>
        <p class="text-body text-muted">{{ BOX_COPY.sub }}</p>
        <p class="flex items-center gap-2" data-testid="box-chip">
          <span class="text-label text-muted">{{ BOX_COPY.chip }}</span>
          <DsRewardChip :value="balance" art="bolt" data-testid="box-chip-value" />
        </p>
      </div>
    </UCard>

    <LoadError v-if="view.error.value && !data" @retry="view.reload()" />
    <LoadSkeleton v-else-if="!data" testid="box-loading" />
    <template v-else>
      <div
        class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4"
        data-testid="box-grid"
      >
        <MysteryBoxCard
          v-for="b in boxes"
          :key="b.id"
          :box="b"
          :token-balance="balance"
          :busy="busy"
          @open="open"
        />
      </div>

      <section v-if="history.length > 0" class="flex flex-col gap-3" data-testid="box-history">
        <h2 class="text-heading text-highlighted">{{ BOX_COPY.historyHeading }}</h2>
        <ul class="flex flex-col gap-2">
          <li v-for="h in history" :key="h.id" data-testid="box-history-row">
            <UCard>
              <div class="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <span class="text-label text-highlighted">Kotak Misteri: {{ h.boxName }}</span>
                <span class="text-label text-primary">+{{ h.coins }} 🪙 · +{{ h.xp }} XP</span>
                <span class="text-caption text-muted">{{ formatDayMonthTime(h.createdAt) }}</span>
              </div>
            </UCard>
          </li>
        </ul>
      </section>
    </template>

    <MysteryResultModal :result="result" @close="result = null" />
  </DsPage>
</template>
