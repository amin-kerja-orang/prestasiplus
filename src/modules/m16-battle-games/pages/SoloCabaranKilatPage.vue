<script setup lang="ts">
/**
 * S14 `/permainan/cabaran-kilat` Cabaran Kilat (FR-M16-76..78, 91, 92; URS FT-M16-6.3; BR-M16-26).
 * 30 MCQ, 60 s, combo multiplier, 400 ms between questions.
 */
import { computed, ref, watch } from 'vue'

import { DsQuizOption, DsLoadError } from '@/ds'
import type { QuizOptionState } from '@/ds'

import CountdownView from '../components/solo/CountdownView.vue'
import DarjahPicker from '../components/solo/DarjahPicker.vue'
import GamePanel from '../components/solo/GamePanel.vue'
import ResultCard from '../components/solo/ResultCard.vue'
import GameHud from '../components/solo/GameHud.vue'
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

const CHIP_COLOR = { green: 'success', amber: 'warning', red: 'error' } as const

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

function optionState(id: number, isCorrect: boolean): QuizOptionState {
  if (picked.value === null) return 'idle'
  if (id === picked.value) return isCorrect ? 'correct' : 'wrong'
  return 'dimmed'
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
  { label: 'Skor Total', value: String(score.value), tone: 'text-primary-t' },
  { label: 'Betul / Jawab', value: ratio(correct.value, answered.value), tone: 'text-success' },
  { label: 'Kombo Maks 🔥', value: `${String(maxCombo.value)}x`, tone: 'text-warning' },
  { label: 'Syiling', value: `${String(result.value.credited)} 🪙`, tone: 'text-info' },
])

watch(darjah, () => void start(), { immediate: true })
</script>

<template>
  <div data-testid="solo-cabaran-kilat">
    <DarjahPicker v-if="darjah === null" title="Cabaran Kilat" art="bolt" />
    <GamePanel>
      <div v-if="loading" class="flex flex-col gap-3" aria-busy="true" data-testid="solo-loading">
        <USkeleton class="h-16 w-full" />
        <USkeleton class="h-16 w-full" />
      </div>
      <DsLoadError v-else-if="error" :message="error" @retry="load()" />

      <CountdownView v-if="phase === 'countdown'" title="⚡ CABARAN KILAT" :count="count" />

      <div v-if="phase === 'playing' && current" class="flex flex-col gap-4">
        <div v-if="combo >= 2" class="flex justify-center">
          <UBadge
            color="warning"
            variant="solid"
            size="xl"
            :data-fire="combo >= 5"
            data-testid="solo-combo"
            >🔥 {{ combo }}x COMBO</UBadge
          >
        </div>
        <GameHud :score="score" :time-left="timeLeft" :max="GAME_SECONDS" :correct="correct" caps />
        <div class="flex items-center justify-between gap-2 pt-2">
          <p class="text-caption text-muted">Soalan {{ index + 1 }}</p>
          <UBadge
            v-if="chip"
            :color="CHIP_COLOR[chip.tone]"
            variant="soft"
            size="lg"
            data-testid="solo-difficulty"
            >{{ chip.label }}</UBadge
          >
        </div>
        <UCard data-testid="solo-card">
          <p class="text-subheading break-words text-highlighted">
            {{ current.question_text }}
          </p>
        </UCard>
        <div class="grid gap-3">
          <DsQuizOption
            v-for="(option, i) in current.options"
            :key="option.id"
            :letter="OPTION_LETTERS[i] ?? ''"
            :state="optionState(option.id, option.correct)"
            data-testid="solo-option"
            @select="pick(option.id)"
          >
            {{ option.text }}
          </DsQuizOption>
        </div>
      </div>

      <ResultCard
        v-if="phase === 'done'"
        theme="cyan"
        :title="cabaranKilatTitle(score)"
        subtitle="60 saat penuh aksi!"
        :tiles="tiles"
        :new-record="result.newRecord"
        again-label="⚡ Main Lagi"
        :coins-credited="result.credited"
        @again="start"
      />
    </GamePanel>
  </div>
</template>
