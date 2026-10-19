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
import { alertNative, confirmNative, useApi } from '@/composables'
import { DsArt3D, DsPage, DsQuizOption } from '@/ds'
import { clock } from '@/lib/time/clock'
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { useRoute } from 'vue-router'

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
const startedAt = ref(clock.now())
const nowMs = ref(clock.now())
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
  startedAt.value = clock.now()
  nowMs.value = startedAt.value
  tick = setInterval(() => {
    nowMs.value = clock.now()
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
  const seconds = Math.min(15, Math.max(0, Math.floor((clock.now() - startedAt.value) / 1000)))
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
    await reload()
    // after the reload: the data watcher above clears `failed` when the stored state arrives
    await nextTick()
    failed.value = true
    locked.value = false
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

/** Option state: the verdict after the answer, the picked one while it is sent, else idle. */
function optionState(id: number): 'idle' | 'selected' | 'correct' | 'wrong' | 'dimmed' {
  const f = feedback.value
  if (f) {
    if (id === f.correctOptionId) return 'correct'
    if (id === picked.value) return 'wrong'
    return 'dimmed'
  }
  if (locked.value) return id === picked.value ? 'selected' : 'dimmed'
  return 'idle'
}
</script>

<template>
  <DsPage data-testid="battle-arena">
    <div v-if="!view && !error" class="flex flex-col gap-4" aria-busy="true">
      <USkeleton class="h-24 w-full" />
      <USkeleton class="h-48 w-full" />
    </div>
    <UAlert
      v-else-if="error && !notFound"
      color="error"
      variant="subtle"
      title="Maaf, berlaku ralat. Sila cuba semula."
    />

    <template v-else-if="view">
      <UAlert
        v-if="failed"
        color="error"
        variant="subtle"
        title="Maaf, berlaku ralat. Sila cuba semula."
      />
      <!-- Players and scores -->
      <div class="grid grid-cols-2 gap-3" data-testid="battle-arena-players">
        <UCard
          v-for="side in ['A', 'B'] as const"
          :key="side"
          :ui="{ body: 'p-3 sm:p-3' }"
          :data-testid="`battle-arena-player-${side}`"
        >
          <div class="flex flex-col items-center gap-1 text-center">
            <UBadge v-if="side === you" color="primary" variant="soft" size="sm">Anda</UBadge>
            <p class="max-w-full truncate text-label text-highlighted">{{ view.players[side].name }}</p>
            <p class="max-w-full truncate text-caption text-muted">{{ view.players[side].school }}</p>
            <p class="mt-2 text-overline text-muted">Skor</p>
            <p
              class="tabular text-title text-primary-t"
              :data-testid="`battle-arena-score-${side}`"
            >
              {{ scores[side] }}
            </p>
          </div>
        </UCard>
      </div>

      <!-- Playing -->
      <UCard v-if="active && question" data-testid="battle-arena-question">
        <div class="flex flex-col gap-3">
          <div class="flex items-center justify-between text-label text-toned">
            <span data-testid="battle-arena-progress">Soalan {{ index }}/{{ view.total }}</span>
            <span class="tabular" data-testid="battle-arena-seconds">{{ remaining }}s</span>
          </div>
          <UProgress
            :model-value="barPct"
            color="primary"
            size="md"
            :aria-label="`Masa ${remaining} saat`"
            data-testid="battle-arena-bar"
          />
          <p class="text-heading break-words text-highlighted" data-testid="battle-arena-text">
            {{ question.text }}
          </p>
          <div class="grid grid-cols-1 gap-2">
            <DsQuizOption
              v-for="(o, i) in question.options"
              :key="o.id"
              :letter="optionLetter(i)"
              :state="optionState(o.id)"
              data-testid="battle-arena-option"
              @select="submit(o.id)"
              >{{ o.text }}</DsQuizOption
            >
          </div>
          <p
            v-if="feedback"
            class="text-center text-label"
            :class="feedback.correct ? 'text-success' : 'text-error'"
            data-testid="battle-arena-feedback"
          >
            {{ feedback.correct ? `+${feedback.points}` : '+0' }}
            <span class="ms-2 text-muted" data-testid="battle-arena-opponent">
              Lawan: {{ feedback.opponent.correct ? 'betul' : 'salah' }}
            </span>
          </p>
          <div class="flex justify-end">
            <UButton
              color="neutral"
              variant="soft"
              size="xl"
              icon="i-ph-flag-duotone"
              class="min-h-12"
              data-testid="battle-arena-forfeit"
              @click="forfeit"
            >
              Tamatkan
            </UButton>
          </div>
        </div>
      </UCard>

      <!-- Result -->
      <UCard v-else-if="result" data-testid="battle-arena-result">
        <div class="flex flex-col items-center gap-3 text-center">
          <DsArt3D :name="title === 'Menang' ? 'trophy' : 'fire'" size="hero" float />
          <h2
            class="text-display"
            :class="title === 'Menang' ? 'text-success' : title === 'Kalah' ? 'text-error' : 'text-toned'"
            data-testid="battle-arena-title"
          >
            {{ title }}
          </h2>
          <p class="tabular text-heading text-highlighted" data-testid="battle-arena-final">
            {{ result.scoreA }} vs {{ result.scoreB }}
          </p>
          <div class="flex flex-wrap justify-center gap-3">
            <UButton
              to="/battle"
              size="xl"
              color="primary"
              class="min-h-12"
              data-testid="battle-arena-again"
              >Mula Battle</UButton
            >
            <UButton
              to="/battle/history"
              size="xl"
              color="neutral"
              variant="soft"
              class="min-h-12"
              data-testid="battle-arena-history"
              >Sejarah Battle</UButton
            >
          </div>
        </div>
      </UCard>
    </template>
  </DsPage>
</template>
