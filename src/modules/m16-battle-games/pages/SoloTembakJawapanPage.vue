<script setup lang="ts">
/**
 * S15 `/permainan/tembak-jawapan` Tembak Jawapan (FR-M16-79..81, 91, 92; URS FT-M16-6.4; BR-M16-26).
 * 30 MCQ, 3 lives. The options of a question fall one after another into a 500 px zone above the
 * "⚠ GARIS MAUT" line; tapping the correct tile scores `10 × level`. Tile timing (base fall 15 − 0.7 per
 * level, min 5 s, plus 0-2 s; 1.8 s apart; miss deadline base + 6 + 2 per option) is the SOURCE rule;
 * the 0-2 s jitter is a deterministic hash instead of `Math.random()` so a replay looks the same (DV-M16-43).
 * BR-M16-26: a wrong tap costs 1 life and does NOT end the question (it continues until a correct tap or the
 * deadline miss, which costs a life and counts as answered). PROPOSED: the wrongly tapped tile is disabled and
 * shown red; a wrong tap itself adds nothing to "answered", so "Ketepatan" = correct / questions resolved.
 *
 * D58a (http mode only): the payload is keyless and the server allows ONE check per item. FORCED DEVIATION: the
 * FIRST tap on a question goes to `POST /check`, which decides correct/wrong and the scoring. Later taps on the
 * same question are judged locally against the key that first check revealed; they can resolve the question
 * but score NOTHING and do not count as correct (the server stored the item as wrong). While the first check
 * is pending taps are ignored and a deadline miss is held back until the result is in. Mock mode is unchanged.
 */
import { computed, ref, watch } from 'vue'

import CountdownView from '../components/solo/CountdownView.vue'
import DarjahPicker from '../components/solo/DarjahPicker.vue'
import GamePanel from '../components/solo/GamePanel.vue'
import ResultCard from '../components/solo/ResultCard.vue'
import {
  fallProgress,
  laneOf,
  missDeadlineSeconds,
  numericId,
  ratio,
  TILE_GAP_MS,
  tembakGain,
  tembakLevel,
  tembakTitle,
  tileFallSeconds,
} from '../components/solo/solo-lib'
import { createInflight, judgeTembakJawapan, settle } from '../components/solo/solo-check'
import { useGameTimers } from '../components/solo/useGameTimers'
import { playCoins, submitResult, useSoloGame } from '../components/solo/useSoloGame'
import { isHttpMode } from '@/api/mode'
import { DsLoadError } from '@/ds'

/** The fall zone is a 4-lane grid of 14 rows; a tile's row follows its fall progress (no inline style). */
const COL = ['col-start-1', 'col-start-2', 'col-start-3', 'col-start-4'] as const
const ROW = [
  'row-start-1',
  'row-start-2',
  'row-start-3',
  'row-start-4',
  'row-start-5',
  'row-start-6',
  'row-start-7',
  'row-start-8',
  'row-start-9',
  'row-start-10',
  'row-start-11',
  'row-start-12',
  'row-start-13',
] as const
const STEP_MS = 800
const TICK_MS = 100
const LIVES = 3
const BANNER_MS = 1200
const LANES = 4

const timers = useGameTimers()
const inflight = createInflight()
const { darjah, payload, loading, error, load } = useSoloGame('tembak-jawapan')

type Phase = 'idle' | 'countdown' | 'playing' | 'submitting' | 'done'
const phase = ref<Phase>('idle')
const count = ref(3)
const index = ref(0)
const level = ref(1)
const maxLevel = ref(1)
const lives = ref(LIVES)
const score = ref(0)
const coins = ref(0)
const correct = ref(0)
const answered = ref(0)
const elapsed = ref(0)
const questionLevel = ref(1)
const banner = ref('')
const wrongTiles = ref<number[]>([])
const result = ref({ newRecord: false, credited: 0 })
/** http mode: the first tap's check is in flight / the correct tile the first check revealed / a miss was held back. */
const checking = ref(false)
const revealedIndex = ref<number | null>(null)
const missDue = ref(false)
let run = 0

const questions = computed(() => payload.value?.questions ?? [])
const current = computed(() => questions.value[index.value])

const tiles = computed(() => {
  const q = current.value
  if (!q) return []
  return q.options.map((option, i) => {
    const startMs = i * TILE_GAP_MS
    const fall = tileFallSeconds(questionLevel.value, numericId(q.id), i)
    return {
      i,
      text: option.text,
      lane: laneOf(numericId(q.id), i, LANES),
      visible: elapsed.value >= startMs,
      col: COL[Math.min(laneOf(numericId(q.id), i, LANES), LANES - 1)] ?? COL[0],
      row: ROW[Math.min(ROW.length - 1, Math.max(0, Math.round(fallProgress(elapsed.value, startMs, fall) * (ROW.length - 1))))] ?? ROW[0],
    }
  })
})

const coinsShown = computed(() => playCoins(payload.value?.canEarnSyiling, coins.value))

function resetQuestionState(): void {
  checking.value = false
  revealedIndex.value = null
  missDue.value = false
}

function reset(): void {
  run += 1
  resetQuestionState()
  timers.clearAll()
  phase.value = 'idle'
  count.value = 3
  index.value = 0
  level.value = 1
  maxLevel.value = 1
  lives.value = LIVES
  score.value = 0
  coins.value = 0
  correct.value = 0
  answered.value = 0
  elapsed.value = 0
  questionLevel.value = 1
  banner.value = ''
  wrongTiles.value = []
  result.value = { newRecord: false, credited: 0 }
}

async function start(): Promise<void> {
  reset()
  if (!(await load())) return
  if (timers.isDisposed()) return // left the page while the session loaded
  phase.value = 'countdown'
  const step = (): void => {
    count.value -= 1
    if (count.value <= 0) beginPlaying()
    else timers.after(step, STEP_MS)
  }
  timers.after(step, STEP_MS)
}

function beginPlaying(): void {
  phase.value = 'playing'
  questionLevel.value = level.value
  timers.every(tick, TICK_MS)
}

function tick(): void {
  if (phase.value !== 'playing') return
  elapsed.value += TICK_MS
  const q = current.value
  if (q && elapsed.value >= missDeadlineSeconds(questionLevel.value, q.options.length) * 1000) {
    if (checking.value) missDue.value = true // held back until the pending check answers
    else missQuestion()
  }
}

function nextQuestion(): void {
  index.value += 1
  elapsed.value = 0
  questionLevel.value = level.value
  wrongTiles.value = []
  resetQuestionState()
  if (index.value >= questions.value.length) void finish()
}

/** A miss (no correct tap by the deadline): −1 life, and the question counts as answered (BR-M16-26). */
function missQuestion(): void {
  answered.value += 1
  lives.value -= 1
  if (lives.value <= 0) void finish()
  else nextQuestion()
}

/** A wrong tile: −1 life, the tile turns red; the question goes on (BR-M16-26). */
function wrongTap(tileIndex: number): void {
  wrongTiles.value = [...wrongTiles.value, tileIndex]
  lives.value -= 1
  if (lives.value <= 0) void finish()
}

function correctTap(): void {
  answered.value += 1
  correct.value += 1
  const gain = tembakGain(level.value)
  score.value += gain.points
  coins.value += gain.coins
  const nextLevel = tembakLevel(correct.value)
  if (nextLevel > level.value) {
    level.value = nextLevel
    maxLevel.value = Math.max(maxLevel.value, nextLevel)
    banner.value = `⚡ LEVEL ${String(nextLevel)}!`
    timers.after(() => {
      banner.value = ''
    }, BANNER_MS)
  }
  nextQuestion()
}

function tap(tileIndex: number): void {
  const q = current.value
  if (phase.value !== 'playing' || !q || checking.value) return
  const option = q.options[tileIndex]
  if (!option || wrongTiles.value.includes(tileIndex)) return
  if (revealedIndex.value !== null) {
    // http mode, a later attempt: judged against the revealed key, resolves the question, scores nothing.
    if (tileIndex !== revealedIndex.value) {
      wrongTap(tileIndex)
      return
    }
    answered.value += 1
    nextQuestion()
    return
  }
  const qi = index.value
  const myRun = run
  checking.value = true
  settle(judgeTembakJawapan(payload.value?.sessionId ?? '', q, tileIndex, inflight), (r) => {
    if (myRun !== run || phase.value !== 'playing' || index.value !== qi) return // stale
    checking.value = false
    if (r?.correct === true) {
      correctTap()
      return
    }
    if (r !== null) {
      if (isHttpMode()) revealedIndex.value = r.correctIndex
      wrongTap(tileIndex)
    }
    // A miss held back while the check was pending; a null result costs nothing, but the deadline stands.
    if (missDue.value && phase.value === 'playing') missQuestion()
  })
}

async function finish(): Promise<void> {
  if (phase.value !== 'playing') return
  phase.value = 'submitting'
  timers.clearAll()
  banner.value = ''
  const res = await submitResult('tembak-jawapan', {
    session_id: payload.value?.sessionId ?? '',
    correct_count: correct.value,
    total_answered: answered.value,
    max_level: maxLevel.value,
    score: score.value,
    syiling_earned: coins.value,
  }, inflight)
  result.value = { newRecord: res?.is_new_record === true, credited: res?.syiling_awarded ?? 0 }
  phase.value = 'done'
}

const resultTiles = computed(() => [
  { label: 'Skor Total', value: String(score.value), tone: 'text-warning' },
  { label: 'Ketepatan', value: ratio(correct.value, answered.value), tone: 'text-success' },
  { label: 'Tertinggi', value: `Level ${String(maxLevel.value)}`, tone: 'text-error' },
  { label: 'Syiling', value: `${String(result.value.credited)} 🪙`, tone: 'text-info' },
])

watch(darjah, () => void start(), { immediate: true })
</script>

<template>
  <div data-testid="solo-tembak-jawapan">
    <DarjahPicker v-if="darjah === null" title="Tembak Jawapan" art="rocket" />
    <GamePanel>
      <div v-if="loading" class="flex flex-col gap-3" aria-busy="true" data-testid="solo-loading">
        <USkeleton class="h-16 w-full" />
        <USkeleton class="h-16 w-full" />
      </div>
      <DsLoadError v-else-if="error" :message="error" @retry="load()" />

      <CountdownView
        v-if="phase === 'countdown'"
        title="🎯 TEMBAK JAWAPAN"
        :count="count"
        hint="Tap jawapan yang betul sebelum jatuh!"
      />

      <div v-if="phase === 'playing' && current" class="flex flex-col gap-3">
        <div class="grid grid-cols-4 gap-2" data-testid="solo-hud">
          <UCard :ui="{ body: 'p-3 sm:p-3' }" class="text-center">
            <p class="text-caption text-muted">Skor</p>
            <p class="tabular text-heading text-primary-t" data-testid="solo-score">{{ score }}</p>
          </UCard>
          <UCard :ui="{ body: 'p-3 sm:p-3' }" class="text-center">
            <p class="text-caption text-muted">Level</p>
            <p class="tabular text-heading text-primary-t" data-testid="solo-level">{{ level }}</p>
          </UCard>
          <UCard :ui="{ body: 'p-3 sm:p-3' }" class="text-center">
            <p class="sr-only">Nyawa</p>
            <div class="flex items-center justify-center gap-1" data-testid="solo-lives">
              <UIcon
                v-for="n in LIVES"
                :key="n"
                :name="n > lives ? 'i-ph-heart-duotone' : 'i-ph-heart-fill'"
                class="size-6"
                :class="n > lives ? 'text-dimmed' : 'text-error'"
                :data-lost="n > lives"
                data-testid="solo-heart"
              />
            </div>
          </UCard>
          <UCard :ui="{ body: 'p-3 sm:p-3' }" class="text-center" data-testid="solo-coins">
            <p class="tabular text-heading text-warning">🪙 {{ coinsShown }}</p>
          </UCard>
        </div>

        <UCard class="text-center">
          <p class="text-overline text-muted">Soalan {{ index + 1 }}</p>
          <p class="mt-1 text-subheading break-words text-highlighted">
            {{ current.question }}
          </p>
        </UCard>

        <div
          id="fallZone"
          class="relative mx-auto grid aspect-4/5 w-full max-w-lg grid-cols-4 grid-rows-14 gap-1 overflow-hidden bg-muted p-2"
          data-testid="solo-fall-zone"
        >
          <template v-for="tile in tiles" :key="`${index}-${tile.i}`">
            <UButton
              v-if="tile.visible"
              type="button"
              :color="wrongTiles.includes(tile.i) ? 'error' : 'primary'"
              variant="soft"
              size="sm"
              class="h-auto min-h-11 max-w-full self-start text-wrap break-words"
              :class="`${tile.col} ${tile.row}`"
              :disabled="wrongTiles.includes(tile.i)"
              :data-wrong="wrongTiles.includes(tile.i)"
              data-testid="solo-tile"
              @click="tap(tile.i)"
            >
              <span class="line-clamp-3 break-words">{{ tile.text }}</span>
            </UButton>
          </template>
          <div v-if="banner" class="col-span-4 row-start-6 text-center" data-testid="solo-level-banner">
            <UBadge color="warning" variant="solid" size="xl">{{ banner }}</UBadge>
          </div>
          <div class="col-span-4 row-start-14 flex items-end justify-end">
            <UBadge color="error" variant="soft" size="lg">⚠ GARIS MAUT</UBadge>
          </div>
        </div>
      </div>

      <ResultCard
        v-if="phase === 'done'"
        theme="ember"
        :title="tembakTitle(score)"
        :subtitle="`Tembak Jawapan — Level ${String(maxLevel)}`"
        :tiles="resultTiles"
        :new-record="result.newRecord"
        again-label="🔄 Main Lagi"
        :coins-credited="result.credited"
        @again="start"
      />
    </GamePanel>
  </div>
</template>
