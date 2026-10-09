<script setup lang="ts">
/**
 * S14 `/permainan/cabaran-kilat` Cabaran Kilat (FR-M16-76..78, 91, 92; URS FT-M16-6.3; BR-M16-26).
 * 30 MCQ, 60 s, combo multiplier, 400 ms between questions.
 */
import { computed, ref, watch } from 'vue'

import CountdownView from '../components/solo/CountdownView.vue'
import DarjahPicker from '../components/solo/DarjahPicker.vue'
import LoadState from '../components/solo/LoadState.vue'
import ResultCard from '../components/solo/ResultCard.vue'
import StatBar from '../components/solo/StatBar.vue'
import {
  cabaranGain,
  cabaranKilatTitle,
  difficultyChip,
  OPTION_LETTERS,
  ratio,
} from '../components/solo/solo-lib'
import { useGameTimers } from '../components/solo/useGameTimers'
import { submitResult, useSoloGame } from '../components/solo/useSoloGame'

const GAME_SECONDS = 60
const NEXT_MS = 400
const STEP_MS = 800

const CHIP_TONE = {
  green: 'bg-emerald-100 text-emerald-700',
  amber: 'bg-amber-100 text-amber-700',
  red: 'bg-red-100 text-red-700',
} as const

const timers = useGameTimers()
const { darjah, payload, loading, error, load } = useSoloGame('cabaran-kilat')

type Phase = 'idle' | 'countdown' | 'playing' | 'submitting' | 'done'
const phase = ref<Phase>('idle')
const count = ref(3)
const index = ref(0)
const score = ref(0)
const combo = ref(0)
const maxCombo = ref(0)
const correct = ref(0)
const answered = ref(0)
const timeLeft = ref(GAME_SECONDS)
const picked = ref<number | null>(null)
const result = ref({ newRecord: false, credited: 0 })
let coins = 0

const questions = computed(() => payload.value?.questions ?? [])
const current = computed(() => questions.value[index.value])
const chip = computed(() => (current.value ? difficultyChip(current.value.difficulty) : null))

function reset(): void {
  timers.clearAll()
  phase.value = 'idle'
  count.value = 3
  index.value = 0
  score.value = 0
  combo.value = 0
  maxCombo.value = 0
  correct.value = 0
  answered.value = 0
  timeLeft.value = GAME_SECONDS
  picked.value = null
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

function pick(optionId: number): void {
  const q = current.value
  if (phase.value !== 'playing' || picked.value !== null || !q) return
  const option = q.options.find((o) => o.id === optionId)
  if (!option) return
  picked.value = optionId
  answered.value += 1
  if (option.correct) {
    correct.value += 1
    combo.value += 1
    maxCombo.value = Math.max(maxCombo.value, combo.value)
    const gain = cabaranGain(combo.value)
    score.value += gain.points
    coins += gain.coins
  } else {
    combo.value = 0
  }
  timers.after(() => {
    picked.value = null
    index.value += 1
    if (index.value >= questions.value.length) void finish()
  }, NEXT_MS)
}

function optionClass(id: number, isCorrect: boolean): string {
  if (picked.value === null) return 'border-slate-200 bg-white hover:border-indigo-400'
  if (id === picked.value) {
    return isCorrect ? 'correct border-emerald-500 bg-emerald-50' : 'wrong border-red-500 bg-red-50'
  }
  return 'border-slate-200 bg-white opacity-70'
}

async function finish(): Promise<void> {
  if (phase.value !== 'playing') return
  timers.clearAll()
  phase.value = 'submitting'
  const res = await submitResult('cabaran-kilat', {
    session_id: payload.value?.sessionId ?? '',
    correct_count: correct.value,
    total_answered: answered.value,
    max_combo: maxCombo.value,
    score: score.value,
    syiling_earned: coins,
  })
  result.value = { newRecord: res?.is_new_record === true, credited: res?.syiling_awarded ?? 0 }
  phase.value = 'done'
}

const tiles = computed(() => [
  { label: 'Skor Total', value: String(score.value) },
  { label: 'Betul / Jawab', value: ratio(correct.value, answered.value) },
  { label: 'Combo Max 🔥', value: `${String(maxCombo.value)}x` },
  { label: 'Syiling', value: `${String(result.value.credited)} 🪙` },
])

watch(darjah, () => void start(), { immediate: true })
</script>

<template>
  <div class="mx-auto w-full max-w-xl" data-testid="solo-cabaran-kilat">
    <DarjahPicker
      v-if="darjah === null"
      emoji="⚡"
      title="Cabaran Kilat"
      color="var(--color-amber-500)"
    />
    <LoadState :loading="loading" :error="error" />

    <CountdownView v-if="phase === 'countdown'" title="⚡ CABARAN KILAT" :count="count" />

    <div v-else-if="phase === 'playing' && current" class="space-y-4">
      <div class="min-h-8 text-center">
        <span
          v-if="combo >= 2"
          class="inline-block rounded-full bg-orange-100 px-4 py-1 text-sm font-extrabold text-orange-600"
          :class="{ fire: combo >= 5 }"
          data-testid="solo-combo"
          >🔥 {{ combo }}x COMBO</span
        >
      </div>
      <StatBar :score="score" :time-left="timeLeft" :correct="correct" />
      <div class="rounded-3xl bg-white p-5 shadow-md" data-testid="solo-card">
        <div class="flex items-center justify-between gap-2">
          <p class="text-xs font-bold tracking-wide text-slate-500">Soalan {{ index + 1 }}</p>
          <span
            v-if="chip"
            class="rounded-full px-3 py-0.5 text-xs font-bold"
            :class="CHIP_TONE[chip.tone]"
            data-testid="solo-difficulty"
            >{{ chip.label }}</span
          >
        </div>
        <p class="mt-3 text-lg font-semibold break-words text-slate-800">
          {{ current.question_text }}
        </p>
        <div class="mt-4 grid gap-3">
          <button
            v-for="(option, i) in current.options"
            :key="option.id"
            type="button"
            class="min-h-12 rounded-2xl border-2 px-4 py-3 text-left text-sm font-semibold break-words text-slate-800 transition"
            :class="optionClass(option.id, option.correct)"
            :disabled="picked !== null"
            data-testid="solo-option"
            @click="pick(option.id)"
          >
            {{ OPTION_LETTERS[i] }}. {{ option.text }}
          </button>
        </div>
      </div>
    </div>

    <ResultCard
      v-else-if="phase === 'done'"
      :title="cabaranKilatTitle(score)"
      subtitle="60 saat penuh aksi!"
      :tiles="tiles"
      :new-record="result.newRecord"
      again-label="⚡ Main Lagi"
      :coins-credited="result.credited"
      @again="start"
    />
  </div>
</template>
