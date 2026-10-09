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
 */
import { computed, ref, watch } from 'vue'

import CountdownView from '../components/solo/CountdownView.vue'
import GamePanel from '../components/solo/GamePanel.vue'
import DarjahPicker from '../components/solo/DarjahPicker.vue'
import LoadState from '../components/solo/LoadState.vue'
import ResultCard from '../components/solo/ResultCard.vue'
import {
  fallProgress,
  laneOf,
  missDeadlineSeconds,
  ratio,
  TILE_GAP_MS,
  tembakGain,
  tembakLevel,
  tembakTitle,
  tileFallSeconds,
  tileJitter,
} from '../components/solo/solo-lib'
import { useGameTimers } from '../components/solo/useGameTimers'
import { playCoins, submitResult, useSoloGame } from '../components/solo/useSoloGame'

const STEP_MS = 800
const TICK_MS = 100
const LIVES = 3
const BANNER_MS = 1200
const LANES = 4

const timers = useGameTimers()
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

const questions = computed(() => payload.value?.questions ?? [])
const current = computed(() => questions.value[index.value])

const tiles = computed(() => {
  const q = current.value
  if (!q) return []
  return q.options.map((option, i) => {
    const startMs = i * TILE_GAP_MS
    const fall = tileFallSeconds(questionLevel.value, q.id, i)
    return {
      i,
      text: option.text,
      lane: laneOf(q.id, i, LANES),
      nudge: tileJitter(q.id, i) * 2,
      visible: elapsed.value >= startMs,
      progress: fallProgress(elapsed.value, startMs, fall),
    }
  })
})

const coinsShown = computed(() => playCoins(payload.value?.canEarnSyiling, coins.value))

function reset(): void {
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
    missQuestion()
  }
}

function nextQuestion(): void {
  index.value += 1
  elapsed.value = 0
  questionLevel.value = level.value
  wrongTiles.value = []
  if (index.value >= questions.value.length) void finish()
}

/** A miss (no correct tap by the deadline): −1 life, and the question counts as answered (BR-M16-26). */
function missQuestion(): void {
  answered.value += 1
  lives.value -= 1
  if (lives.value <= 0) void finish()
  else nextQuestion()
}

function tap(tileIndex: number): void {
  const q = current.value
  if (phase.value !== 'playing' || !q) return
  const option = q.options[tileIndex]
  if (!option || wrongTiles.value.includes(tileIndex)) return
  if (!option.correct) {
    // BR-M16-26: a wrong tap costs a life and does not end the question; it goes on until a correct tap or
    // the deadline miss. PROPOSED: the wrong tile is disabled (red) so it cannot be tapped again.
    wrongTiles.value = [...wrongTiles.value, tileIndex]
    lives.value -= 1
    if (lives.value <= 0) void finish()
    return
  }
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
  })
  result.value = { newRecord: res?.is_new_record === true, credited: res?.syiling_awarded ?? 0 }
  phase.value = 'done'
}

const resultTiles = computed(() => [
  { label: 'Skor Total', value: String(score.value), tone: 'text-orange-400' },
  { label: 'Ketepatan', value: ratio(correct.value, answered.value), tone: 'text-emerald-400' },
  { label: 'Tertinggi', value: `Level ${String(maxLevel.value)}`, tone: 'text-red-400' },
  { label: 'Syiling', value: `${String(result.value.credited)} 🪙`, tone: 'text-yellow-300' },
])

watch(darjah, () => void start(), { immediate: true })
</script>

<template>
  <div data-testid="solo-tembak-jawapan">
    <DarjahPicker
      v-if="darjah === null"
      emoji="🎯"
      title="Tembak Jawapan"
      color="var(--color-orange-500)"
    />
    <GamePanel theme="ember">
      <LoadState :loading="loading" :error="error" />

      <CountdownView
        v-if="phase === 'countdown'"
        title="🎯 TEMBAK JAWAPAN"
        :count="count"
        hint="Tap jawapan yang betul sebelum jatuh!"
        tone="text-orange-500"
      />

      <div v-if="phase === 'playing' && current" class="mx-auto max-w-5xl space-y-3">
        <div class="flex items-center justify-between gap-2" data-testid="solo-hud">
          <div
            class="min-w-14 rounded-2xl border border-white/10 bg-white/5 px-3 py-1.5 text-center"
          >
            <div class="text-xs text-slate-300">Skor</div>
            <div class="text-lg font-extrabold text-orange-400" data-testid="solo-score">
              {{ score }}
            </div>
          </div>
          <div
            class="min-w-14 rounded-2xl border border-white/10 bg-white/5 px-3 py-1.5 text-center"
          >
            <div class="text-xs text-slate-300">Level</div>
            <div class="text-lg font-extrabold text-orange-400" data-testid="solo-level">
              {{ level }}
            </div>
          </div>
          <div class="text-xl" data-testid="solo-lives">
            <span
              v-for="n in LIVES"
              :key="n"
              class="mx-0.5"
              :class="n > lives ? 'opacity-25' : ''"
              data-testid="solo-heart"
              >❤️</span
            >
          </div>
          <div
            class="min-w-14 rounded-2xl border border-white/10 bg-white/5 px-3 py-1.5 text-center text-lg font-extrabold text-yellow-300"
            data-testid="solo-coins"
          >
            🪙 {{ coinsShown }}
          </div>
        </div>

        <div class="rounded-3xl border border-orange-500/30 bg-orange-500/10 p-4 text-center">
          <!-- Live: dim orange (≈ 3.5:1), kept as live (G4 minor 4). -->
          <p class="text-xs font-semibold tracking-wider text-orange-700 uppercase">
            Soalan {{ index + 1 }}
          </p>
          <p class="mt-1 font-heading text-base font-bold break-words text-white">
            {{ current.question }}
          </p>
        </div>

        <div
          id="fallZone"
          class="relative h-[500px] w-full overflow-hidden rounded-3xl border border-white/5 bg-black/30"
          data-testid="solo-fall-zone"
        >
          <template v-for="tile in tiles" :key="`${index}-${tile.i}`">
            <button
              v-if="tile.visible"
              type="button"
              :disabled="wrongTiles.includes(tile.i)"
              class="absolute flex min-h-11 max-w-[22%] items-center justify-center"
              :style="{
                left: `${String(tile.lane * 24 + tile.nudge)}%`,
                top: `calc((100% - 3.5rem - 1.5rem) * ${String(tile.progress)})`,
                transition: 'top 100ms linear',
              }"
              data-testid="solo-tile"
              @click="tap(tile.i)"
            >
              <span
                class="line-clamp-3 block rounded-xl border px-3 py-2 text-xs font-bold break-words text-white shadow-lg sm:text-sm"
                :class="
                  wrongTiles.includes(tile.i)
                    ? 'border-red-400 bg-red-600/80'
                    : 'border-white/25 bg-white/10'
                "
                >{{ tile.text }}</span
              >
            </button>
          </template>
          <div
            v-if="banner"
            class="absolute inset-x-0 top-1/3 text-center text-3xl font-extrabold text-amber-300"
            data-testid="solo-level-banner"
          >
            {{ banner }}
          </div>
          <div
            class="absolute inset-x-4 bottom-2 h-px bg-gradient-to-r from-transparent via-red-500 to-transparent"
          />
          <!-- Live: a dark red on near-black (≈ 2:1); DV-M16-47 lightens it. -->
          <div class="absolute right-4 bottom-3 text-xs font-bold tracking-wider text-red-400">
            ⚠ GARIS MAUT
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
