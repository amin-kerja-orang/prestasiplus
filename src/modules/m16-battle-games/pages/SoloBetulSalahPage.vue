<script setup lang="ts">
/**
 * S13 `/permainan/betul-salah` Betul atau Salah (FR-M16-71..75, 91, 92; URS FT-M16-6.1, 6.2; BR-M16-26).
 * 40 statements, 45 s. The countdown and the clock start only after a darjah is chosen (DV-M16-18).
 * Syiling shown = credited (DV-M16-23); the score and the counted syiling are computed here as on live.
 */
import { computed, ref, watch } from 'vue'

import CountdownView from '../components/solo/CountdownView.vue'
import DarjahPicker from '../components/solo/DarjahPicker.vue'
import GamePanel from '../components/solo/GamePanel.vue'
import LoadState from '../components/solo/LoadState.vue'
import ResultCard from '../components/solo/ResultCard.vue'
import StatBar from '../components/solo/StatBar.vue'
import { betulSalahGain, betulSalahTitle, ratio } from '../components/solo/solo-lib'
import { useGameTimers } from '../components/solo/useGameTimers'
import { submitResult, useSoloGame } from '../components/solo/useSoloGame'

const GAME_SECONDS = 45
const FEEDBACK_MS = 700
const STEP_MS = 800

const timers = useGameTimers()
const { darjah, payload, loading, error, load } = useSoloGame('betul-salah')

type Phase = 'idle' | 'countdown' | 'playing' | 'submitting' | 'done'
const phase = ref<Phase>('idle')
const count = ref(3)
const index = ref(0)
const score = ref(0)
const streak = ref(0)
const maxStreak = ref(0)
const correct = ref(0)
const answered = ref(0)
const timeLeft = ref(GAME_SECONDS)
const feedback = ref<'' | '✅' | '❌'>('')
const result = ref({ newRecord: false, credited: 0 })
let coins = 0

const statements = computed(() => payload.value?.statements ?? [])
const current = computed(() => statements.value[index.value])

function reset(): void {
  timers.clearAll()
  phase.value = 'idle'
  count.value = 3
  index.value = 0
  score.value = 0
  streak.value = 0
  maxStreak.value = 0
  correct.value = 0
  answered.value = 0
  timeLeft.value = GAME_SECONDS
  feedback.value = ''
  result.value = { newRecord: false, credited: 0 }
  coins = 0
}

async function start(): Promise<void> {
  reset()
  if (!(await load())) return
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
  timers.every(() => {
    timeLeft.value -= 1
    if (timeLeft.value <= 0) void finish()
  }, 1000)
}

function answer(choice: boolean): void {
  const item = current.value
  if (phase.value !== 'playing' || feedback.value !== '' || !item) return
  const ok = choice === item.is_true
  answered.value += 1
  if (ok) {
    correct.value += 1
    streak.value += 1
    maxStreak.value = Math.max(maxStreak.value, streak.value)
    const gain = betulSalahGain(streak.value)
    score.value += gain.points
    coins += gain.coins
  } else {
    streak.value = 0
  }
  feedback.value = ok ? '✅' : '❌'
  timers.after(() => {
    feedback.value = ''
    index.value += 1
    if (index.value >= statements.value.length) void finish()
  }, FEEDBACK_MS)
}

async function finish(): Promise<void> {
  if (phase.value !== 'playing') return
  timers.clearAll()
  phase.value = 'submitting'
  const res = await submitResult('betul-salah', {
    session_id: payload.value?.sessionId ?? '',
    correct_count: correct.value,
    total_answered: answered.value,
    streak: maxStreak.value,
    score: score.value,
    syiling_earned: coins,
  })
  result.value = { newRecord: res?.is_new_record === true, credited: res?.syiling_awarded ?? 0 }
  phase.value = 'done'
}

const tiles = computed(() => [
  { label: 'Skor Total', value: String(score.value), tone: 'text-violet-300' },
  { label: 'Ketepatan', value: ratio(correct.value, answered.value), tone: 'text-emerald-400' },
  { label: 'Kombo Max', value: `${String(maxStreak.value)} 🔥`, tone: 'text-amber-400' },
  { label: 'Syiling', value: `${String(result.value.credited)} 🪙`, tone: 'text-cyan-300' },
])

watch(darjah, () => void start(), { immediate: true })
</script>

<template>
  <div data-testid="solo-betul-salah">
    <DarjahPicker
      v-if="darjah === null"
      emoji="✅"
      title="Betul atau Salah"
      color="var(--color-emerald-500)"
    />
    <GamePanel theme="indigo">
      <LoadState :loading="loading" :error="error" />

      <CountdownView
        v-if="phase === 'countdown'"
        title="✅❌ BETUL ATAU SALAH"
        :count="count"
        tone="text-violet-500"
      />

      <div v-if="phase === 'playing' && current" class="mx-auto max-w-xl space-y-4">
        <div class="min-h-8 text-center">
          <span
            v-if="streak >= 2"
            class="inline-block rounded-full bg-gradient-to-r from-orange-500 to-red-500 px-4 py-1 text-sm font-extrabold text-white shadow-lg"
            :class="{ hot: streak >= 5 }"
            data-testid="solo-combo"
            >🔥 {{ streak }} KOMBO</span
          >
        </div>
        <StatBar :score="score" :time-left="timeLeft" :max="GAME_SECONDS" :correct="correct" />
        <p class="text-center text-xs text-slate-300">Kenyataan {{ index + 1 }}</p>
        <div
          class="relative rounded-3xl border border-white/10 bg-white/5 p-6 text-center transition"
          :class="{
            'ring-2 ring-emerald-400': feedback === '✅',
            'ring-2 ring-red-400': feedback === '❌',
          }"
          data-testid="solo-card"
        >
          <p class="font-heading text-lg font-bold break-words text-white">
            {{ current.statement }}
          </p>
          <div
            v-if="feedback"
            class="absolute inset-0 flex items-center justify-center rounded-3xl bg-slate-950/70 text-7xl"
            data-testid="solo-feedback"
          >
            {{ feedback }}
          </div>
        </div>
        <div class="flex justify-center gap-8 pt-2">
          <div class="text-center">
            <button
              type="button"
              class="flex h-20 w-20 items-center justify-center rounded-full border-2 border-red-500/50 bg-red-950/40 text-4xl transition hover:bg-red-900/60 disabled:opacity-60"
              :disabled="feedback !== ''"
              data-testid="solo-salah"
              @click="answer(false)"
            >
              ❌
            </button>
            <p class="mt-2 text-xs text-slate-300">❌ SALAH</p>
          </div>
          <div class="text-center">
            <button
              type="button"
              class="flex h-20 w-20 items-center justify-center rounded-full border-2 border-emerald-500/50 bg-emerald-950/40 text-4xl transition hover:bg-emerald-900/60 disabled:opacity-60"
              :disabled="feedback !== ''"
              data-testid="solo-betul"
              @click="answer(true)"
            >
              ✅
            </button>
            <p class="mt-2 text-xs text-slate-300">✅ BETUL</p>
          </div>
        </div>
      </div>

      <ResultCard
        v-if="phase === 'done'"
        theme="indigo"
        :title="betulSalahTitle(score)"
        subtitle="45 saat — Betul atau Salah!"
        :tiles="tiles"
        :new-record="result.newRecord"
        again-label="🔄 Main Lagi"
        :coins-credited="result.credited"
        @again="start"
      />
    </GamePanel>
  </div>
</template>
