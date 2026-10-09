<script setup lang="ts">
/**
 * `/battle/arena/:uuid` provisional arena (M16-T3; SRS M16 v1.6 FR-M16-34..38, BR-M16-07..09; URS
 * FN-M16-2.5). PROPOSED layout built from observed parts: both players (name, school) with "Skor",
 * "Soalan {n}/10", the question card and options "A." to "D.", a 15 s countdown bar and the
 * "Tamatkan" button; result "Menang" / "Seri" / "Kalah" with both scores and two links.
 *
 * A player of the battle only: an unknown or foreign uuid is the global 404 (#16). Each answer
 * posts #17 with the whole seconds used; the reply carries the correct option, the points, the
 * bot's reply and either the next question or the result. Timers are cleared on unmount.
 */
import { isApiError } from '@/api'
import { setRouteOutcome } from '@/app/router'
import { AlertBox, LoadingSpinner } from '@/components/feedback'
import { alertNative, confirmNative, useApi } from '@/composables'
import { Flag } from '@lucide/vue'
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

import {
  answerArena,
  fetchArena,
  forfeitBattle,
  type ArenaAnswerResult,
  type ArenaQuestion,
  type ArenaView,
  type Winner,
} from '../api'
import { BATTLE_MSG, optionLetter } from '../components/battle/battle-lib'

const QUESTION_MS = 15_000
const FEEDBACK_MS = 1_200
const TICK_MS = 250

const route = useRoute()
const uuid = computed(() => String(route.params.uuid ?? ''))
const { data, error, reload } = useApi((signal) => fetchArena(uuid.value, { signal }), uuid)

const notFound = computed(() => isApiError(error.value) && error.value.status === 404)
watch(
  notFound,
  (yes) => {
    if (yes) setRouteOutcome(404)
  },
  { immediate: true },
)

const view = shallowRef<ArenaView | null>(null)
const scores = ref({ A: 0, B: 0 })
const index = ref(1)
const question = shallowRef<ArenaQuestion | null>(null)
const result = shallowRef<{ winner: Winner; scoreA: number; scoreB: number } | null>(null)
const locked = ref(false)
const picked = ref<number | null>(null)
const feedback = shallowRef<ArenaAnswerResult | null>(null)
const startedAt = ref(Date.now())
const nowMs = ref(Date.now())
const failed = ref(false)

let tick: ReturnType<typeof setInterval> | null = null
let next: ReturnType<typeof setTimeout> | null = null

function stopTimers(): void {
  if (tick !== null) clearInterval(tick)
  tick = null
  if (next !== null) clearTimeout(next)
  next = null
}

function startQuestionTimer(): void {
  stopTimers()
  startedAt.value = Date.now()
  nowMs.value = startedAt.value
  tick = setInterval(() => {
    nowMs.value = Date.now()
    if (!locked.value && nowMs.value - startedAt.value >= QUESTION_MS) void submit(null)
  }, TICK_MS)
}

watch(data, (v) => {
  if (!v) return
  stopTimers()
  view.value = v
  scores.value = { ...v.scores }
  index.value = v.index
  question.value = v.question
  result.value = v.result ?? null
  locked.value = false
  picked.value = null
  feedback.value = null
  failed.value = false
  if (v.status === 'active' && v.question) startQuestionTimer()
})

onBeforeUnmount(stopTimers)

const remaining = computed(() =>
  Math.max(0, Math.ceil((QUESTION_MS - (nowMs.value - startedAt.value)) / 1000)),
)
const barPct = computed(() =>
  Math.max(0, Math.min(100, ((QUESTION_MS - (nowMs.value - startedAt.value)) / QUESTION_MS) * 100)),
)
const active = computed(() => view.value?.status === 'active' && result.value === null)
const you = computed(() => view.value?.you ?? 'A')
const title = computed<'Menang' | 'Seri' | 'Kalah' | ''>(() => {
  const r = result.value
  if (!r) return ''
  if (r.winner === null) return 'Seri'
  return r.winner === you.value ? 'Menang' : 'Kalah'
})

async function submit(optionId: number | null): Promise<void> {
  const q = question.value
  if (locked.value || !q || !active.value) return
  locked.value = true
  picked.value = optionId
  const seconds = Math.min(15, Math.max(0, Math.floor((Date.now() - startedAt.value) / 1000)))
  if (tick !== null) clearInterval(tick)
  tick = null
  try {
    const res = await answerArena(uuid.value, { questionId: q.id, optionId, seconds })
    feedback.value = res
    const side = you.value
    const other = side === 'A' ? 'B' : 'A'
    scores.value = { ...scores.value, [side]: res.you.score, [other]: res.opponent.score }
    next = setTimeout(() => {
      next = null
      feedback.value = null
      picked.value = null
      if (res.result) {
        result.value = res.result
        question.value = null
        return
      }
      question.value = res.next ?? null
      index.value += 1
      locked.value = false
      startQuestionTimer()
    }, FEEDBACK_MS)
  } catch {
    // the battle changed under us (finished, forfeited): show the stored state
    failed.value = true
    await reload()
  }
}

async function forfeit(): Promise<void> {
  if (!confirmNative(BATTLE_MSG.forfeitConfirm)) return
  stopTimers()
  try {
    await forfeitBattle(uuid.value)
    await reload()
  } catch {
    alertNative(BATTLE_MSG.forfeitNetwork)
    if (view.value?.status === 'active' && question.value) {
      locked.value = false
      startQuestionTimer()
    }
  }
}

function optionClass(id: number): string {
  const f = feedback.value
  if (f) {
    if (id === f.correctOptionId) return 'border-green-500 bg-green-50 text-green-800'
    if (id === picked.value) return 'border-red-500 bg-red-50 text-red-800'
    return 'border-slate-200 bg-white text-slate-400'
  }
  return 'border-slate-200 bg-white text-slate-700 hover:border-orange-300 hover:bg-orange-50'
}
</script>

<template>
  <div class="mx-auto w-full max-w-2xl space-y-4" data-testid="battle-arena">
    <div v-if="!view && !error" class="flex justify-center py-10 text-slate-400">
      <LoadingSpinner :size="28" />
    </div>
    <AlertBox v-else-if="error && !notFound" messages="Maaf, berlaku ralat. Sila cuba semula." />

    <template v-else-if="view">
      <AlertBox v-if="failed" messages="Maaf, berlaku ralat. Sila cuba semula." />
      <!-- Players and scores -->
      <div class="grid grid-cols-2 gap-3" data-testid="battle-arena-players">
        <div
          v-for="side in ['A', 'B'] as const"
          :key="side"
          class="rounded-2xl border-2 bg-white p-3 text-center shadow-sm"
          :class="side === you ? 'border-orange-300' : 'border-slate-200'"
          :data-testid="`battle-arena-player-${side}`"
        >
          <p class="truncate text-sm font-bold text-slate-800">{{ view.players[side].name }}</p>
          <p class="truncate text-xs text-slate-500">{{ view.players[side].school }}</p>
          <p class="mt-2 text-xs font-semibold text-slate-400 uppercase">Skor</p>
          <p class="text-2xl font-bold text-orange-600" :data-testid="`battle-arena-score-${side}`">
            {{ scores[side] }}
          </p>
        </div>
      </div>

      <!-- Playing -->
      <div
        v-if="active && question"
        class="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
        data-testid="battle-arena-question"
      >
        <div class="flex items-center justify-between text-sm font-semibold text-slate-600">
          <span data-testid="battle-arena-progress">Soalan {{ index }}/{{ view.total }}</span>
          <span data-testid="battle-arena-seconds">{{ remaining }}s</span>
        </div>
        <div class="h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            class="h-full rounded-full bg-gradient-to-r from-red-500 to-orange-500"
            :style="{ width: `${barPct}%` }"
            data-testid="battle-arena-bar"
          />
        </div>
        <p class="text-base font-semibold text-slate-800" data-testid="battle-arena-text">
          {{ question.text }}
        </p>
        <div class="grid grid-cols-1 gap-2">
          <button
            v-for="(o, i) in question.options"
            :key="o.id"
            type="button"
            class="min-h-11 rounded-xl border-2 px-4 py-2.5 text-left text-sm font-medium transition disabled:cursor-default"
            :class="optionClass(o.id)"
            :disabled="locked"
            data-testid="battle-arena-option"
            @click="submit(o.id)"
          >
            {{ optionLetter(i) }}. {{ o.text }}
          </button>
        </div>
        <p
          v-if="feedback"
          class="text-center text-sm font-semibold"
          :class="feedback.correct ? 'text-green-600' : 'text-red-600'"
          data-testid="battle-arena-feedback"
        >
          {{ feedback.correct ? `+${feedback.points}` : '+0' }}
          <span class="ml-2 text-slate-500" data-testid="battle-arena-opponent">
            Lawan: {{ feedback.opponent.correct ? 'betul' : 'salah' }}
          </span>
        </p>
        <div class="flex justify-end">
          <button
            type="button"
            class="inline-flex min-h-11 items-center gap-2 rounded-xl border-2 border-slate-200 px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            data-testid="battle-arena-forfeit"
            @click="forfeit"
          >
            <Flag class="h-4 w-4" /> Tamatkan
          </button>
        </div>
      </div>

      <!-- Result -->
      <div
        v-else-if="result"
        class="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm"
        data-testid="battle-arena-result"
      >
        <h2
          class="text-3xl font-bold"
          :class="
            title === 'Menang'
              ? 'text-green-600'
              : title === 'Kalah'
                ? 'text-red-600'
                : 'text-slate-700'
          "
          data-testid="battle-arena-title"
        >
          {{ title }}
        </h2>
        <p class="mt-2 text-lg font-semibold text-slate-700" data-testid="battle-arena-final">
          {{ result.scoreA }} vs {{ result.scoreB }}
        </p>
        <div class="mt-5 flex flex-wrap justify-center gap-3">
          <RouterLink
            to="/battle"
            class="inline-flex min-h-11 items-center rounded-xl bg-gradient-to-r from-red-500 to-orange-500 px-5 text-sm font-bold text-white"
            data-testid="battle-arena-again"
            >Mula Battle</RouterLink
          >
          <RouterLink
            to="/battle/history"
            class="inline-flex min-h-11 items-center rounded-xl border-2 border-slate-200 px-5 text-sm font-bold text-slate-700"
            data-testid="battle-arena-history"
            >Sejarah Battle</RouterLink
          >
        </div>
      </div>
    </template>
  </div>
</template>
