<script setup lang="ts">
/**
 * `/permainan/jutawan/main?subject=&darjah=` Jutawan game (FR-M16-98; URS FN-M16-7.2.3; BR-M16-30).
 * PROVISIONAL: live never opened this page. 15 questions of rising difficulty, one wrong answer ends the
 * game, 3 "50:50" lifelines (one per question). The server grades every answer, the keys never reach
 * the client. The result updates "Rekod Tertinggi" and "Permainan" of S19.
 */
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

import { AlertBox } from '@/components/feedback'

import { answerJutawan, lifelineJutawan, startJutawan } from '../api'
import type { RoomQuestion } from '../api'
import JutawanLadder from '../components/jutawan/JutawanLadder.vue'
import LoadState from '../components/solo/LoadState.vue'
import { JUTAWAN_LEVELS } from '../components/solo/solo-lib'
import { useGameTimers } from '../components/solo/useGameTimers'

const FEEDBACK_MS = 700

const route = useRoute()
const timers = useGameTimers()

const subject = computed(() => Number(route.query.subject))
const darjah = computed(() => Number(route.query.darjah))
const paramsOk = computed(
  () =>
    Number.isInteger(subject.value) &&
    subject.value > 0 &&
    Number.isInteger(darjah.value) &&
    darjah.value >= 1 &&
    darjah.value <= 11,
)

type Phase = 'loading' | 'playing' | 'done' | 'error'
const phase = ref<Phase>('loading')
const error = ref('')
const sessionId = ref('')
const question = ref<RoomQuestion | null>(null)
const level = ref(0)
const lifelines = ref(0)
const removed = ref<number[]>([])
const busy = ref(false)
const picked = ref<{ id: number; correct: boolean } | null>(null)
const result = ref({ level: 0, credited: 0 })

async function start(): Promise<void> {
  timers.clearAll()
  phase.value = 'loading'
  error.value = ''
  level.value = 0
  removed.value = []
  picked.value = null
  busy.value = false
  if (!paramsOk.value) {
    phase.value = 'error'
    error.value = 'Subjek atau darjah tidak sah.'
    return
  }
  try {
    const data = await startJutawan({ subject: subject.value, darjah: darjah.value })
    sessionId.value = data.sessionId
    question.value = data.question
    lifelines.value = data.lifelines
    phase.value = 'playing'
  } catch (e) {
    phase.value = 'error'
    error.value = e instanceof Error ? e.message : 'Ralat memulakan permainan.'
  }
}

async function choose(optionId: number): Promise<void> {
  const q = question.value
  if (phase.value !== 'playing' || busy.value || !q) return
  busy.value = true
  try {
    const res = await answerJutawan(sessionId.value, { questionId: q.id, optionId })
    picked.value = { id: optionId, correct: res.correct }
    timers.after(() => {
      picked.value = null
      busy.value = false
      level.value = res.level
      if (res.result) {
        result.value = { level: res.result.level, credited: res.result.credited }
        phase.value = 'done'
      } else if (res.next) {
        question.value = res.next
        removed.value = []
      }
    }, FEEDBACK_MS)
  } catch (e) {
    busy.value = false
    phase.value = 'error'
    error.value = e instanceof Error ? e.message : 'Ralat menghantar jawapan.'
  }
}

async function useLifeline(): Promise<void> {
  if (phase.value !== 'playing' || busy.value || lifelines.value <= 0 || removed.value.length > 0)
    return
  busy.value = true
  try {
    const res = await lifelineJutawan(sessionId.value)
    removed.value = res.removedOptionIds
    lifelines.value = res.lifelines
  } catch {
    // none left: the button is disabled, nothing to show
  } finally {
    busy.value = false
  }
}

function optionClass(id: number): string {
  if (picked.value?.id === id) {
    return picked.value.correct
      ? 'correct border-emerald-500 bg-emerald-50'
      : 'wrong border-red-500 bg-red-50'
  }
  return 'border-slate-200 bg-white hover:border-amber-400'
}

onMounted(() => void start())
</script>

<template>
  <div class="mx-auto w-full max-w-4xl space-y-4" data-testid="jutawan-game">
    <LoadState :loading="phase === 'loading'" error="" />
    <div v-if="phase === 'error'" class="space-y-3">
      <AlertBox :messages="error" />
      <RouterLink
        to="/permainan/jutawan"
        class="inline-flex min-h-11 items-center text-sm font-semibold text-indigo-600"
        >← Pilih subjek</RouterLink
      >
    </div>

    <div v-else-if="phase === 'playing' && question" class="grid gap-4 md:grid-cols-[8rem_1fr]">
      <JutawanLadder :level="level" />
      <div class="space-y-4">
        <div class="flex items-center justify-between gap-2">
          <p class="text-sm font-bold text-slate-600" data-testid="jutawan-progress">
            Soalan {{ level + 1 }} / {{ JUTAWAN_LEVELS }}
          </p>
          <button
            type="button"
            class="min-h-11 rounded-xl bg-amber-100 px-4 py-2 text-sm font-bold text-amber-800 hover:bg-amber-200 disabled:opacity-50"
            :disabled="busy || lifelines <= 0 || removed.length > 0"
            data-testid="jutawan-lifeline"
            @click="useLifeline"
          >
            50:50 ({{ lifelines }})
          </button>
        </div>
        <div class="rounded-3xl bg-white p-5 shadow-md" data-testid="jutawan-question">
          <p class="text-lg font-semibold break-words text-slate-800">{{ question.text }}</p>
          <div class="mt-4 grid gap-3">
            <template v-for="option in question.options" :key="option.id">
              <button
                v-if="!removed.includes(option.id)"
                type="button"
                class="min-h-12 rounded-2xl border-2 px-4 py-3 text-left text-sm font-semibold break-words text-slate-800 transition"
                :class="optionClass(option.id)"
                :disabled="busy"
                data-testid="jutawan-option"
                @click="choose(option.id)"
              >
                {{ option.label }}. {{ option.text }}
              </button>
            </template>
          </div>
        </div>
      </div>
    </div>

    <section
      v-else-if="phase === 'done'"
      class="mx-auto w-full max-w-md rounded-3xl bg-white p-6 text-center shadow-lg"
      data-testid="jutawan-result"
    >
      <div class="text-5xl">💰</div>
      <h2 class="mt-2 font-heading text-2xl font-extrabold text-slate-800">
        Tahniah! Anda sampai L{{ result.level }}.
      </h2>
      <p v-if="result.credited > 0" class="mt-2 text-lg font-extrabold text-amber-600">
        +{{ result.credited }} 🪙
      </p>
      <div class="mt-6 grid grid-cols-2 gap-3">
        <button
          type="button"
          class="min-h-11 rounded-xl bg-indigo-600 px-3 py-3 text-sm font-bold text-white hover:bg-indigo-700"
          data-testid="jutawan-again"
          @click="start"
        >
          🔄 Main Lagi
        </button>
        <RouterLink
          to="/permainan"
          class="flex min-h-11 items-center justify-center rounded-xl bg-slate-100 px-3 py-3 text-sm font-bold text-slate-700 hover:bg-slate-200"
          >🎮 Hub</RouterLink
        >
      </div>
    </section>
  </div>
</template>
