<script setup lang="ts">
/**
 * `/permainan/jutawan/main?subject=&darjah=` Jutawan game (FR-M16-98; URS FN-M16-7.2.3; BR-M16-30).
 * PROVISIONAL: live never opened this page. 15 questions of rising difficulty, one wrong answer ends the
 * game, 3 "50:50" lifelines (one per question). The server grades every answer, the keys never reach
 * the client. The result updates "Rekod Tertinggi" and "Permainan" of S19.
 */
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'

import { DsArt3D, DsQuizOption, DsSticker } from '@/ds'
import type { QuizOptionState } from '@/ds'

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

function optionState(id: number): QuizOptionState {
  if (picked.value === null) return 'idle'
  if (picked.value.id === id) return picked.value.correct ? 'correct' : 'wrong'
  return 'dimmed'
}

onMounted(() => void start())
</script>

<template>
  <div data-testid="jutawan-game">
    <GamePanel>
      <LoadState :loading="phase === 'loading'" error="" />
      <div v-if="phase === 'error'" class="flex flex-col items-start gap-3">
        <UAlert color="error" variant="subtle" :title="error" class="w-full" />
        <UButton to="/permainan/jutawan" color="neutral" variant="soft" class="min-h-11">
          ← Pilih subjek
        </UButton>
      </div>

      <div v-else-if="phase === 'playing' && question" class="grid gap-4 md:grid-cols-4">
        <div class="md:col-span-1"><JutawanLadder :level="level" /></div>
        <div class="flex min-w-0 flex-col gap-4 md:col-span-3">
          <div class="flex items-center justify-between gap-2">
            <p class="text-label text-toned" data-testid="jutawan-progress">
              Soalan {{ level + 1 }} / {{ JUTAWAN_LEVELS }}
            </p>
            <UButton
              type="button"
              color="warning"
              variant="soft"
              size="lg"
              class="min-h-11"
              :disabled="busy || lifelines <= 0 || removed.length > 0"
              data-testid="jutawan-lifeline"
              @click="useLifeline"
            >
              50:50 ({{ lifelines }})
            </UButton>
          </div>
          <UCard data-testid="jutawan-question">
            <p class="text-subheading break-words text-highlighted">
              {{ question.text }}
            </p>
            <div class="mt-4 grid gap-3">
              <template v-for="option in question.options" :key="option.id">
                <DsQuizOption
                  v-if="!removed.includes(option.id)"
                  :letter="option.label"
                  :state="optionState(option.id)"
                  data-testid="jutawan-option"
                  @select="choose(option.id)"
                >
                  {{ option.text }}
                </DsQuizOption>
              </template>
            </div>
          </UCard>
        </div>
      </div>

      <UCard v-else-if="phase === 'done'" class="mx-auto w-full max-w-md text-center" data-testid="jutawan-result">
        <div class="flex flex-col items-center gap-3">
          <DsArt3D name="coin" size="hero" float />
          <h1 class="text-title text-highlighted">Tahniah! Anda sampai L{{ result.level }}.</h1>
          <DsSticker v-if="result.credited > 0" art="coin">+{{ result.credited }} 🪙</DsSticker>
          <div class="mt-3 grid w-full grid-cols-2 gap-3">
            <UButton
              type="button"
              size="xl"
              color="primary"
              variant="solid"
              class="min-h-12 justify-center"
              data-testid="jutawan-again"
              @click="start"
            >
              🔄 Main Lagi
            </UButton>
            <UButton to="/permainan" size="xl" color="neutral" variant="soft" class="min-h-12 justify-center">
              🎮 Hub
            </UButton>
          </div>
        </div>
      </UCard>
    </GamePanel>
  </div>
</template>
