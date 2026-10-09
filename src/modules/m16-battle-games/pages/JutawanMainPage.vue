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
import GamePanel from '../components/solo/GamePanel.vue'
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
      ? 'correct border-emerald-400 bg-emerald-500/20'
      : 'wrong border-red-400 bg-red-500/20'
  }
  return 'border-white/15 bg-white/5 hover:border-amber-400/60'
}

onMounted(() => void start())
</script>

<template>
  <div data-testid="jutawan-game">
    <GamePanel theme="navy">
      <div class="mx-auto max-w-4xl space-y-4">
        <LoadState :loading="phase === 'loading'" error="" />
        <div v-if="phase === 'error'" class="space-y-3">
          <AlertBox :messages="error" />
          <RouterLink
            to="/permainan/jutawan"
            class="inline-flex min-h-11 items-center text-sm font-semibold text-amber-400"
            >← Pilih subjek</RouterLink
          >
        </div>

        <div v-else-if="phase === 'playing' && question" class="grid gap-4 md:grid-cols-[8rem_1fr]">
          <JutawanLadder :level="level" />
          <div class="space-y-4">
            <div class="flex items-center justify-between gap-2">
              <p class="text-sm font-bold text-slate-200" data-testid="jutawan-progress">
                Soalan {{ level + 1 }} / {{ JUTAWAN_LEVELS }}
              </p>
              <button
                type="button"
                class="min-h-11 rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-2 text-sm font-bold text-amber-300 hover:bg-amber-400/20 disabled:opacity-40"
                :disabled="busy || lifelines <= 0 || removed.length > 0"
                data-testid="jutawan-lifeline"
                @click="useLifeline"
              >
                50:50 ({{ lifelines }})
              </button>
            </div>
            <div
              class="rounded-3xl border border-white/10 bg-white/5 p-5"
              data-testid="jutawan-question"
            >
              <p class="font-heading text-lg font-bold break-words text-white">
                {{ question.text }}
              </p>
              <div class="mt-4 grid gap-3">
                <template v-for="option in question.options" :key="option.id">
                  <button
                    v-if="!removed.includes(option.id)"
                    type="button"
                    class="min-h-12 rounded-2xl border-2 px-4 py-3 text-left text-base font-bold break-words text-white transition"
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
          class="mx-auto w-full max-w-md rounded-3xl border border-amber-400/30 bg-white/5 p-6 text-center"
          data-testid="jutawan-result"
        >
          <div class="text-5xl">💰</div>
          <h2 class="mt-2 font-heading text-2xl font-extrabold text-white">
            Tahniah! Anda sampai L{{ result.level }}.
          </h2>
          <p v-if="result.credited > 0" class="mt-2 text-lg font-extrabold text-amber-300">
            +{{ result.credited }} 🪙
          </p>
          <div class="mt-6 grid grid-cols-2 gap-3">
            <button
              type="button"
              class="min-h-12 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-3 py-3 text-base font-bold text-slate-950 hover:brightness-110"
              data-testid="jutawan-again"
              @click="start"
            >
              🔄 Main Lagi
            </button>
            <RouterLink
              to="/permainan"
              class="flex min-h-12 items-center justify-center rounded-xl bg-white/10 px-3 py-3 text-base font-bold text-slate-100 hover:bg-white/20"
              >🎮 Hub</RouterLink
            >
          </div>
        </section>
      </div>
    </GamePanel>
  </div>
</template>
