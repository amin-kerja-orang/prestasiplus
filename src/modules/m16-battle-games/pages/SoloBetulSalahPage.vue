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
import ResultCard from '../components/solo/ResultCard.vue'
import GameHud from '../components/solo/GameHud.vue'
import { betulSalahGain, betulSalahTitle, ratio } from '../components/solo/solo-lib'
import { useGameTimers } from '../components/solo/useGameTimers'
import { submitResult, useSoloGame } from '../components/solo/useSoloGame'
import { DsLoadError } from '@/ds'

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
  { label: 'Skor Total', value: String(score.value), tone: 'text-primary-t' },
  { label: 'Ketepatan', value: ratio(correct.value, answered.value), tone: 'text-success' },
  { label: 'Kombo Max', value: `${String(maxStreak.value)} 🔥`, tone: 'text-warning' },
  { label: 'Syiling', value: `${String(result.value.credited)} 🪙`, tone: 'text-info' },
])

watch(darjah, () => void start(), { immediate: true })
</script>

<template>
  <div data-testid="solo-betul-salah">
    <DarjahPicker v-if="darjah === null" title="Betul atau Salah" art="trophy" />
    <GamePanel>
      <div v-if="loading" class="flex flex-col gap-3" aria-busy="true" data-testid="solo-loading">
        <USkeleton class="h-16 w-full" />
        <USkeleton class="h-16 w-full" />
      </div>
      <DsLoadError v-else-if="error" :message="error" @retry="load()" />

      <CountdownView v-if="phase === 'countdown'" title="✅❌ BETUL ATAU SALAH" :count="count" />

      <div v-if="phase === 'playing' && current" class="flex flex-col gap-4">
        <div v-if="streak >= 2" class="flex justify-center">
          <UBadge
            color="warning"
            variant="solid"
            size="xl"
            :data-hot="streak >= 5"
            data-testid="solo-combo"
            >🔥 {{ streak }} KOMBO</UBadge
          >
        </div>
        <GameHud :score="score" :time-left="timeLeft" :max="GAME_SECONDS" :correct="correct" />
        <p class="text-center text-caption text-muted">Kenyataan {{ index + 1 }}</p>
        <UCard class="relative text-center" :data-feedback="feedback" data-testid="solo-card">
          <p class="text-subheading break-words text-highlighted">
            {{ current.statement }}
          </p>
          <div
            v-if="feedback"
            class="absolute inset-0 grid place-items-center bg-default/80 text-display"
            data-testid="solo-feedback"
          >
            {{ feedback }}
          </div>
        </UCard>
        <div class="flex justify-center gap-8 pt-2">
          <div class="flex flex-col items-center gap-2">
            <UButton
              type="button"
              color="error"
              variant="soft"
              class="size-20 justify-center"
              aria-label="Salah"
              :disabled="feedback !== ''"
              data-testid="solo-salah"
              @click="answer(false)"
            >
              <UIcon name="i-ph-x-bold" class="size-10" aria-hidden="true" />
            </UButton>
            <p class="text-caption text-muted">❌ SALAH</p>
          </div>
          <div class="flex flex-col items-center gap-2">
            <UButton
              type="button"
              color="success"
              variant="soft"
              class="size-20 justify-center"
              aria-label="Betul"
              :disabled="feedback !== ''"
              data-testid="solo-betul"
              @click="answer(true)"
            >
              <UIcon name="i-ph-check-bold" class="size-10" aria-hidden="true" />
            </UButton>
            <p class="text-caption text-muted">✅ BETUL</p>
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
