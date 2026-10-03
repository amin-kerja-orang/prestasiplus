<script setup lang="ts">
/**
 * S6 `/gamification/mystery-box` (FR-M15-48..53; URS FT-M15-6.1, 6.2): hero with the token chip,
 * four box cards, the PROPOSED opening flow (#11) with its result modal, and the PROPOSED history
 * card (hidden when the viewer has no opening).
 */
import { computed, ref, shallowRef } from 'vue'

import { LoadingSpinner } from '@/components/feedback'
import { useApi, useFlash } from '@/composables'

import {
  fetchMysteryBoxes,
  openMysteryBox,
  type MysteryBoxesView,
  type MysteryBoxOpened,
} from '../api'
import { BOX_COPY } from '../components/copy'
import { errorMessage, formatDayMonthTime } from '../components/format'
import LoadError from '../components/LoadError.vue'
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
  <div class="min-w-0 space-y-6" data-testid="m15-box-page">
    <section
      class="flex flex-col items-center gap-2 rounded-[20px] bg-linear-to-br from-indigo-950 via-indigo-900 to-indigo-700 px-4 py-6 text-center text-white shadow sm:px-6"
      data-testid="box-hero"
    >
      <h1 class="text-xl font-bold text-white sm:text-2xl" data-testid="box-title">
        {{ BOX_COPY.heading }}
      </h1>
      <p class="text-sm text-white/90">{{ BOX_COPY.sub }}</p>
      <p
        class="mt-1 inline-flex items-center gap-1 rounded-full bg-white/15 px-4 py-1 text-sm text-white"
        data-testid="box-chip"
      >
        {{ BOX_COPY.chip }} <strong data-testid="box-chip-value">{{ balance }}</strong>
      </p>
    </section>

    <LoadError v-if="view.error.value && !data" @retry="view.reload()" />
    <div
      v-else-if="!data"
      class="flex justify-center py-10 text-slate-400"
      data-testid="box-loading"
    >
      <LoadingSpinner :size="28" />
    </div>
    <template v-else>
      <div
        class="grid grid-cols-[repeat(auto-fill,minmax(min(220px,100%),1fr))] gap-4"
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

      <section
        v-if="history.length > 0"
        class="rounded-2xl bg-white p-4 shadow-sm sm:p-5"
        data-testid="box-history"
      >
        <h2 class="font-heading text-lg font-bold text-slate-800">{{ BOX_COPY.historyHeading }}</h2>
        <ul class="mt-3 divide-y divide-slate-100">
          <li
            v-for="h in history"
            :key="h.id"
            class="flex flex-col gap-1 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
            data-testid="box-history-row"
          >
            <span class="font-semibold text-slate-700">Kotak Misteri: {{ h.boxName }}</span>
            <span class="text-[#7c3aed]">+{{ h.coins }} 🪙 · +{{ h.xp }} XP</span>
            <span class="text-xs text-slate-500">{{ formatDayMonthTime(h.createdAt) }}</span>
          </li>
        </ul>
      </section>
    </template>

    <MysteryResultModal :result="result" @close="result = null" />
  </div>
</template>
