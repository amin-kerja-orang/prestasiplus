<script setup lang="ts">
/**
 * S13 `/permainan/betul-salah` Betul atau Salah (FR-M16-71..75, 91, 92; URS FT-M16-6.1, 6.2; BR-M16-26).
 * 40 statements, 45 s. The countdown and the clock start only after a darjah is chosen (DV-M16-18).
 * Syiling shown = credited (DV-M16-23); the score and the counted syiling are computed here as on live.
 */
import { computed, ref, watch } from 'vue'

import CountdownView from '../components/solo/CountdownView.vue'
import DarjahPicker from '../components/solo/DarjahPicker.vue'
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

let coins = 0

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
  { label: 'Skor Total', value: String(score.value) },
  { label: 'Ketepatan', value: ratio(correct.value, answered.value) },
  { label: 'Kombo Max', value: `${String(maxStreak.value)} 🔥` },
  { label: 'Syiling', value: `${String(result.value.credited)} 🪙` },
])

watch(darjah, () => void start(), { immediate: true })
</script>

<template>
  <div class="mx-auto w-full max-w-xl" data-testid="solo-betul-salah">
    <DarjahPicker
      v-if="darjah === null"
      emoji="✅"
      title="Betul atau Salah"
      color="var(--color-emerald-500)"
    />
    <LoadState :loading="loading" :error="error" />

    <CountdownView v-if="phase === 'countdown'" title="✅❌ BETUL ATAU SALAH" :count="count" />

    <div v-else-if="phase === 'playing' && current" class="space-y-4">
      <div class="min-h-8 text-center">
        <span
          v-if="streak >= 2"
          class="inline-block rounded-full bg-orange-100 px-4 py-1 text-sm font-extrabold text-orange-600"
          :class="{ hot: streak >= 5 }"
          data-testid="solo-combo"
          >🔥 {{ streak }} KOMBO</span
        >
      </div>
      <StatBar :score="score" :time-left="timeLeft" :correct="correct" />
      <div
        class="relative rounded-3xl bg-white p-6 text-center shadow-md transition"
        :class="{
          'ring-4 ring-emerald-400': feedback === '✅',
          'ring-4 ring-red-400': feedback === '❌',
        }"
        data-testid="solo-card"
      >
        <p class="text-xs font-bold tracking-wide text-slate-500">Kenyataan {{ index + 1 }}</p>
        <p class="mt-3 text-lg font-semibold break-words text-slate-800">
          {{ current.statement }}
        </p>
        <div
          v-if="feedback"
          class="absolute inset-0 flex items-center justify-center rounded-3xl bg-white/70 text-7xl"
          data-testid="solo-feedback"
        >
          {{ feedback }}
        </div>
      </div>
      <div class="grid grid-cols-2 gap-4">
        <button
          type="button"
          class="min-h-16 rounded-2xl bg-red-500 text-4xl shadow-md transition hover:bg-red-600 disabled:opacity-60"
          :disabled="feedback !== ''"
          data-testid="solo-salah"
          @click="answer(false)"
        >
          ❌
        </button>
        <button
          type="button"
          class="min-h-16 rounded-2xl bg-emerald-500 text-4xl shadow-md transition hover:bg-emerald-600 disabled:opacity-60"
          :disabled="feedback !== ''"
          data-testid="solo-betul"
          @click="answer(true)"
        >
          ✅
        </button>
      </div>
      <p class="text-center text-xs font-semibold text-slate-500">❌ SALAH &nbsp; ✅ BETUL</p>
    </div>

    <ResultCard
      v-else-if="phase === 'done'"
      :title="betulSalahTitle(score)"
      subtitle="45 saat — Betul atau Salah!"
      :tiles="tiles"
      :new-record="result.newRecord"
      again-label="🔄 Main Lagi"
      :coins-credited="result.credited"
      @again="start"
    />
  </div>
</template>
