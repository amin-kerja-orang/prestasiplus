<script setup lang="ts">
/**
 * S17 `/permainan/kad-memori` Kad Memori (FR-M16-86..89, 91, 92; URS FT-M16-6.6; BR-M16-26).
 * No darjah picker. 12 cards = 6 question/answer pairs shuffled by the server (no client reshuffle);
 * a move = 2 flips; a mismatch shows `wrong` and flips back after 800 ms. The result overlay is not
 * closed by a click outside it.
 */
import { computed, onMounted, ref } from 'vue'

import { DsPage, DsLoadError } from '@/ds'

import type { SoloItemId } from '../api'
import ResultCard from '../components/solo/ResultCard.vue'
import { createInflight, judgePair, revealCard, settle } from '../components/solo/solo-check'
import type { Face } from '../components/solo/solo-check'
import { GENERIC_ERROR } from '../components/lobby/lobby-lib'
import { formatClock } from '../components/solo/solo-lib'
import { useGameTimers } from '../components/solo/useGameTimers'
import { submitResult, useSoloGame } from '../components/solo/useSoloGame'

const PAIRS = 6
const MISMATCH_MS = 800

const toast = useToast()
const timers = useGameTimers()
const inflight = createInflight()
let runId = 0 // bumped by reset(): a check that lands after a restart is dropped
const { payload, loading, error, load } = useSoloGame('kad-memori', false)

type Phase = 'idle' | 'playing' | 'submitting' | 'done'
const phase = ref<Phase>('idle')
const seconds = ref(0)
const moves = ref(0)
const flipped = ref<SoloItemId[]>([])
const matched = ref<SoloItemId[]>([])
const wrong = ref<SoloItemId[]>([])
const locked = ref(false)
const faces = ref<Record<string, Face>>({}) // known faces (http: from the server)
const result = ref({ accuracy: 0, coins: 0, time: 0, moves: null as number | null })

const cards = computed(() => payload.value?.cards ?? [])
const matchedPairs = computed(() => matched.value.length / 2)

function reset(): void {
  runId += 1
  faces.value = {}
  timers.clearAll()
  phase.value = 'idle'
  seconds.value = 0
  moves.value = 0
  flipped.value = []
  matched.value = []
  wrong.value = []
  locked.value = false
  result.value = { accuracy: 0, coins: 0, time: 0, moves: null }
}

/**
 * A reveal or a pair check that failed (network, or 409: a card already open / the pair already checked) leaves
 * the server and the board out of step, so the board is never left frozen: tell the player and start a new session.
 */
function failAndRestart(): void {
  toast.add({ title: GENERIC_ERROR, color: 'error' })
  // Not awaited on purpose: start() never rejects (load() catches its own errors and reports them through `error`).
  void start()
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

function flip(cardId: SoloItemId): void {
  if (phase.value !== 'playing' || locked.value) return
  if (flipped.value.includes(cardId) || matched.value.includes(cardId)) return
  const card = cards.value.find((c) => c.id === cardId)
  if (!card) return
  const run = runId
  const sessionId = payload.value?.sessionId ?? ''
  const stale = () => run !== runId || phase.value !== 'playing' || timers.isDisposed()
  // An exception inside a settled result must not leave the board locked.
  const recover = () => {
    if (stale()) return
    flipped.value = []
    wrong.value = []
    locked.value = false
  }

  if (flipped.value.length === 0) {
    // First card of a move: its face comes from the reveal route (http); the mock reads it at once.
    flipped.value = [cardId]
    locked.value = true
    settle(revealCard(sessionId, card, inflight), (face) => {
      if (stale()) return
      if (!face) {
        failAndRestart() // reveal failed (incl. 409)
        return
      }
      faces.value = { ...faces.value, [String(cardId)]: face }
      locked.value = false
    }, recover)
    return
  }

  const first = cards.value.find((c) => c.id === flipped.value[0])
  if (!first) return
  flipped.value = [first.id, cardId]
  moves.value += 1
  locked.value = true
  settle(judgePair(sessionId, first, card, inflight), (res) => {
    if (stale()) return
    if (!res) {
      failAndRestart() // pair check failed (incl. 409)
      return
    }
    const next = { ...faces.value }
    if (res.faces[0]) next[String(first.id)] = res.faces[0]
    if (res.faces[1]) next[String(cardId)] = res.faces[1]
    faces.value = next
    if (res.correct) {
      matched.value = [...matched.value, first.id, cardId]
      flipped.value = []
      locked.value = false
      if (matchedPairs.value >= PAIRS) void finish()
      return
    }
    // Mismatch: show `wrong`, flip back after 800 ms.
    wrong.value = [...flipped.value]
    timers.after(() => {
      wrong.value = []
      flipped.value = []
      locked.value = false
    }, MISMATCH_MS)
  }, recover)
}

async function finish(): Promise<void> {
  phase.value = 'submitting'
  timers.clearAll()
  const time = seconds.value
  const res = await submitResult(
    'kad-memori',
    {
      session_id: payload.value?.sessionId ?? '',
      matches: PAIRS,
      total_pairs: PAIRS,
      moves: moves.value,
      time_seconds: time,
    },
    inflight,
  )
  result.value = {
    accuracy: res?.results?.accuracy ?? Math.round((PAIRS / Math.max(moves.value, 1)) * 100),
    coins: res?.results?.syiling_earned ?? 0,
    time: res?.results?.time_seconds ?? time,
    moves: res?.results?.moves ?? null,
  }
  phase.value = 'done'
}

function cardState(id: SoloItemId): 'matched' | 'wrong' | 'flipped' | '' {
  if (matched.value.includes(id)) return 'matched'
  if (wrong.value.includes(id)) return 'wrong'
  if (flipped.value.includes(id)) return 'flipped'
  return ''
}

const CARD_COLOR = {
  matched: 'success',
  wrong: 'error',
  flipped: 'info',
  '': 'primary',
} as const
const CARD_VARIANT = { matched: 'soft', wrong: 'soft', flipped: 'soft', '': 'solid' } as const

const resultTiles = computed(() => [
  { label: 'Masa', value: formatClock(result.value.time), tone: 'text-info' },
  { label: 'Langkah', value: String(result.value.moves ?? moves.value), tone: 'text-primary-t' },
  { label: 'Ketepatan', value: `${String(result.value.accuracy)}%`, tone: 'text-success' },
  { label: 'Syiling 🪙', value: `+${String(result.value.coins)}`, tone: 'text-warning' },
])

onMounted(() => void start())
</script>

<template>
  <DsPage data-testid="solo-kad-memori">
    <div class="flex flex-col items-start gap-1">
      <UButton to="/permainan" color="neutral" variant="ghost" icon="i-ph-arrow-left" class="min-h-11">
        Permainan
      </UButton>
      <h1 class="text-title text-highlighted">🃏 Kad Memori</h1>
      <p class="text-body text-muted">Padankan soalan dengan jawapan yang betul!</p>
    </div>

    <div class="flex flex-wrap gap-3" data-testid="solo-stats">
      <UBadge color="neutral" variant="soft" size="xl" data-testid="solo-time"
        >⏱️ {{ formatClock(seconds) }}</UBadge
      >
      <UBadge color="neutral" variant="soft" size="xl" data-testid="solo-moves"
        >👆 {{ moves }} langkah</UBadge
      >
      <UBadge color="success" variant="soft" size="xl" data-testid="solo-matched"
        >✅ {{ matchedPairs }} / {{ PAIRS }} padan</UBadge
      >
    </div>

    <div v-if="loading" class="flex flex-col gap-3" aria-busy="true" data-testid="solo-loading">
      <USkeleton class="h-16 w-full" />
      <USkeleton class="h-16 w-full" />
    </div>
    <DsLoadError v-else-if="error" :message="error" @retry="start()" />

    <div
      v-if="cards.length > 0"
      class="mx-auto grid w-full max-w-2xl grid-cols-3 gap-3 sm:grid-cols-4"
      data-testid="solo-cards"
    >
      <UButton
        v-for="card in cards"
        :key="card.id"
        type="button"
        size="xl"
        :color="CARD_COLOR[cardState(card.id)]"
        :variant="CARD_VARIANT[cardState(card.id)]"
        class="aspect-square h-auto min-w-0 justify-center overflow-hidden p-2 text-center text-wrap break-words"
        :data-state="cardState(card.id) || 'hidden'"
        :data-type="cardState(card.id) !== '' ? faces[String(card.id)]?.type : undefined"
        data-testid="solo-card-item"
        @click="flip(card.id)"
      >
        <span v-if="cardState(card.id) === ''" class="text-title">❓</span>
        <span v-else class="text-caption">{{ faces[String(card.id)]?.content ?? '' }}</span>
      </UButton>
    </div>

    <ResultCard
      v-if="phase === 'done'"
      theme="indigo"
      title="🎉 Tahniah!"
      subtitle="Semua kad berjaya dipadankan!"
      :tiles="resultTiles"
      :new-record="false"
      again-label="🔄 Main Lagi"
      :coins-credited="0"
      hub-label="🏠 Hub"
      overlay-testid="solo-overlay"
      @again="start"
    />
  </DsPage>
</template>
