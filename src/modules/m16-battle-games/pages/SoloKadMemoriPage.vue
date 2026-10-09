<script setup lang="ts">
/**
 * S17 `/permainan/kad-memori` Kad Memori (FR-M16-86..89, 91, 92; URS FT-M16-6.6; BR-M16-26).
 * No darjah picker. 12 cards = 6 question/answer pairs shuffled by the server (no client reshuffle);
 * a move = 2 flips; a mismatch shows `wrong` and flips back after 800 ms. The result overlay is not
 * closed by a click outside it.
 */
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { ArrowLeft } from '@lucide/vue'

import LoadState from '../components/solo/LoadState.vue'
import { formatClock } from '../components/solo/solo-lib'
import { useGameTimers } from '../components/solo/useGameTimers'
import { submitResult, useSoloGame } from '../components/solo/useSoloGame'

const PAIRS = 6
const MISMATCH_MS = 800

const timers = useGameTimers()
const { payload, loading, error, load } = useSoloGame('kad-memori', false)

type Phase = 'idle' | 'playing' | 'submitting' | 'done'
const phase = ref<Phase>('idle')
const seconds = ref(0)
const moves = ref(0)
const flipped = ref<number[]>([])
const matched = ref<number[]>([])
const wrong = ref<number[]>([])
const locked = ref(false)
const result = ref({ accuracy: 0, coins: 0, time: 0 })

const cards = computed(() => payload.value?.cards ?? [])
const matchedPairs = computed(() => matched.value.length / 2)

function reset(): void {
  timers.clearAll()
  phase.value = 'idle'
  seconds.value = 0
  moves.value = 0
  flipped.value = []
  matched.value = []
  wrong.value = []
  locked.value = false
  result.value = { accuracy: 0, coins: 0, time: 0 }
}

async function start(): Promise<void> {
  reset()
  if (!(await load())) return
  if (timers.isDisposed()) return // left the page while the session loaded
  phase.value = 'playing'
  timers.every(() => {
    seconds.value += 1
  }, 1000)
}

function flip(cardId: number): void {
  if (phase.value !== 'playing' || locked.value) return
  if (flipped.value.includes(cardId) || matched.value.includes(cardId)) return
  flipped.value = [...flipped.value, cardId]
  if (flipped.value.length < 2) return
  moves.value += 1
  const [a, b] = flipped.value.map((id) => cards.value.find((c) => c.id === id))
  if (a && b && a.pair_id === b.pair_id && a.type !== b.type) {
    matched.value = [...matched.value, a.id, b.id]
    flipped.value = []
    if (matchedPairs.value >= PAIRS) void finish()
    return
  }
  locked.value = true
  wrong.value = [...flipped.value]
  timers.after(() => {
    wrong.value = []
    flipped.value = []
    locked.value = false
  }, MISMATCH_MS)
}

async function finish(): Promise<void> {
  phase.value = 'submitting'
  timers.clearAll()
  const time = seconds.value
  const res = await submitResult('kad-memori', {
    session_id: payload.value?.sessionId ?? '',
    matches: PAIRS,
    total_pairs: PAIRS,
    moves: moves.value,
    time_seconds: time,
  })
  result.value = {
    accuracy: res?.results?.accuracy ?? Math.round((PAIRS / Math.max(moves.value, 1)) * 100),
    coins: res?.results?.syiling_earned ?? 0,
    time,
  }
  phase.value = 'done'
}

function cardState(id: number): string {
  if (matched.value.includes(id)) return 'matched'
  if (wrong.value.includes(id)) return 'wrong'
  if (flipped.value.includes(id)) return 'flipped'
  return ''
}

const CARD_TONE: Record<string, string> = {
  matched: 'matched border-emerald-300 bg-emerald-50 text-emerald-900',
  wrong: 'wrong border-red-300 bg-red-50 text-red-800',
  flipped: 'flipped border-indigo-300 bg-indigo-50 text-indigo-900',
  '': 'border-transparent bg-gradient-to-br from-indigo-500 to-purple-700 text-white hover:brightness-110',
}

onMounted(() => void start())
</script>

<template>
  <div class="w-full space-y-4 px-2 sm:px-4" data-testid="solo-kad-memori">
    <div>
      <RouterLink
        to="/permainan"
        class="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-violet-600 hover:text-violet-800"
      >
        <ArrowLeft :size="16" /> Permainan
      </RouterLink>
      <h2 class="flex items-center gap-2 font-heading text-2xl font-extrabold text-slate-800">
        🃏 Kad Memori
      </h2>
      <p class="text-sm text-slate-500">Padankan soalan dengan jawapan yang betul!</p>
    </div>

    <div class="flex flex-wrap gap-3 text-sm font-bold text-slate-700" data-testid="solo-stats">
      <span class="rounded-xl bg-white px-4 py-2.5 shadow-sm" data-testid="solo-time"
        >⏱️ {{ formatClock(seconds) }}</span
      >
      <span class="rounded-xl bg-white px-4 py-2.5 shadow-sm" data-testid="solo-moves"
        >👆 {{ moves }} langkah</span
      >
      <span class="rounded-xl bg-white px-4 py-2.5 shadow-sm" data-testid="solo-matched"
        >✅ {{ matchedPairs }} / {{ PAIRS }} padan</span
      >
    </div>

    <LoadState :loading="loading" :error="error" />

    <!-- Live: 98 px cards at 375 (3 per row) and 151 px from 768 (4 per row). -->
    <div
      v-if="cards.length > 0"
      class="mx-auto flex max-w-[41rem] flex-wrap justify-center gap-3"
      data-testid="solo-cards"
    >
      <button
        v-for="card in cards"
        :key="card.id"
        type="button"
        class="flex h-[98px] w-[98px] shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 p-2 text-center text-xs leading-tight font-bold break-words shadow-lg transition sm:h-[151px] sm:w-[151px] sm:text-sm"
        :class="[
          CARD_TONE[cardState(card.id)],
          cardState(card.id) !== ''
            ? card.type === 'question'
              ? 'type-question'
              : 'type-answer'
            : '',
        ]"
        data-testid="solo-card-item"
        @click="flip(card.id)"
      >
        <span v-if="cardState(card.id) === ''" class="text-4xl">❓</span>
        <span v-else>{{ card.content }}</span>
      </button>
    </div>

    <Teleport to="body">
      <div
        v-if="phase === 'done'"
        class="fixed inset-0 z-[200] flex animate-fade-in items-center justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-sm"
        data-testid="solo-overlay"
      >
        <div class="w-full max-w-[25rem] rounded-3xl bg-white p-6 text-center shadow-2xl">
          <div class="text-6xl">🎉</div>
          <h3 class="mt-2 font-heading text-2xl font-extrabold text-slate-800">Tahniah!</h3>
          <p class="mt-1 text-base text-slate-600">Semua kad berjaya dipadankan!</p>
          <div class="mt-4 grid grid-cols-2 gap-3 text-center">
            <div class="rounded-2xl bg-blue-50 p-3">
              <div class="text-2xl font-extrabold text-blue-600">
                {{ formatClock(result.time) }}
              </div>
              <div class="text-xs font-medium text-slate-600">Masa</div>
            </div>
            <div class="rounded-2xl bg-violet-50 p-3">
              <div class="text-2xl font-extrabold text-violet-700">{{ moves }}</div>
              <div class="text-xs font-medium text-slate-600">Langkah</div>
            </div>
            <div class="rounded-2xl bg-green-50 p-3">
              <div class="text-2xl font-extrabold text-green-700">{{ result.accuracy }}%</div>
              <div class="text-xs font-medium text-slate-600">Ketepatan</div>
            </div>
            <div class="rounded-2xl bg-amber-50 p-3">
              <div class="text-2xl font-extrabold text-orange-700" data-testid="solo-coins">
                +{{ result.coins }}
              </div>
              <div class="text-xs font-medium text-slate-600">Syiling 🪙</div>
            </div>
          </div>
          <div class="mt-5 grid grid-cols-2 gap-3">
            <button
              type="button"
              class="min-h-12 rounded-xl bg-gradient-to-r from-sky-600 to-sky-700 px-3 py-3 text-base font-bold text-white shadow hover:brightness-110"
              data-testid="solo-again"
              @click="start"
            >
              🔄 Main Lagi
            </button>
            <RouterLink
              to="/permainan"
              class="flex min-h-12 items-center justify-center rounded-xl bg-slate-100 px-3 py-3 text-base font-bold text-slate-700 hover:bg-slate-200"
              >🏠 Hub</RouterLink
            >
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
