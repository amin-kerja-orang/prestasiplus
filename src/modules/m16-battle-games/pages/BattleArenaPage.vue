<script setup lang="ts">
/**
 * `/battle/arena/:uuid` arena (M16-T3; SRS M16 v1.6 FR-M16-34..38, BR-M16-07..09; URS FN-M16-2.5;
 * 48 GAME-01 rounds). Rounds are shared and server-driven: the screen follows the view's `phase`.
 *
 * - `answering`: the question, options and a countdown drawn from `secondsLeft` (the grace is
 *   invisible: the options stay enabled until the server says the phase changed). After an answer,
 *   or when the view says `youAnswered` (a refresh), the waiting state shows, never the question as
 *   open.
 * - `reveal`: the key, both picks and the points of the round just closed, until `roundEndsAt`;
 *   then the next round is read.
 * - `finished`: the result (win, lose, draw, forfeit, abandoned).
 *
 * A player of the battle only: an unknown or foreign uuid is the global 404 (#16). The answer
 * response carries no key and no correctness (ruling 45): correctness comes only from `reveal`. One
 * interval (250 ms) draws the countdown and reads the view at the poll cadence (`BATTLE_POLL_MS`) and
 * at each phase deadline. Timers are cleared on unmount.
 */
import { isApiError } from '@/api'
import { setRouteOutcome } from '@/app/router'
import { alertNative, useApi } from '@/composables'
import { DsArt3D, DsPage, DsQuizOption, useConfirm } from '@/ds'
import { clock } from '@/lib/time/clock'
import { toEpochMs } from '@/lib/time/zone'
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { useRoute } from 'vue-router'

import {
  answerArena,
  BATTLE_POLL_MS,
  fetchArena,
  forfeitBattle,
  type ArenaPhase,
  type ArenaView,
  type Winner,
} from '../api'
import { BATTLE_MSG, optionLetter } from '../components/battle/battle-lib'
import { lastStartFor } from '../composables/useBattleSearch'

const TICK_MS = 250
/** The contract caps `seconds` at 60 (`battle_question_seconds` is at most 60). */
const MAX_SECONDS = 60

const route = useRoute()
const uuid = computed(() => String(route.params.uuid ?? ''))
const confirm = useConfirm()
/** Held only when this battle came from Quick Match / Battle Sekolah in this session. */
const again = computed(() => lastStartFor(uuid.value))
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
const picked = ref<number | null>(null)
const locked = ref(false)
const answeredLocal = ref(false)
/** When the current view arrived, with its `secondsLeft`: the countdown runs from these. */
const viewAt = ref(clock.now())
const nowMs = ref(clock.now())
/** The longest `secondsLeft` seen in this round: the bar's full length. */
const roundSeconds = ref(0)
const failed = ref(false)

let tick: ReturnType<typeof setInterval> | null = null
let polling = false
let lastFetchAt = 0

function stopTimers(): void {
  if (tick !== null) clearInterval(tick)
  tick = null
}

const phase = computed<ArenaPhase>(() => {
  const v = view.value
  if (!v) return 'answering'
  if (v.phase) return v.phase
  return v.status === 'active' && !v.result ? 'answering' : 'finished'
})
const question = computed(() => view.value?.question ?? null)
const result = computed(() => view.value?.result ?? null)
const reveal = computed(() => (phase.value === 'reveal' ? (view.value?.reveal ?? null) : null))
const scores = computed(() => view.value?.scores ?? { A: 0, B: 0 })
const you = computed(() => view.value?.you ?? 'A')
const answered = computed(() => answeredLocal.value || view.value?.youAnswered === true)
const deadlineMs = computed(() => {
  const at = view.value?.roundEndsAt
  return at === undefined ? null : toEpochMs(at)
})

/** Seconds left to answer: from the view's `secondsLeft`, never from the deadline (grace is invisible). */
const remaining = computed(() => {
  if (phase.value !== 'answering' || !view.value) return 0
  return Math.max(0, Math.ceil(view.value.secondsLeft - (nowMs.value - viewAt.value) / 1000))
})
const barPct = computed(() => {
  const full = Math.max(roundSeconds.value, 1)
  return Math.max(0, Math.min(100, (remaining.value / full) * 100))
})

function applyView(v: ArenaView): void {
  const prev = view.value
  const newRound = !prev || v.question?.id !== prev.question?.id || v.index !== prev.index
  view.value = v
  viewAt.value = clock.now()
  nowMs.value = viewAt.value
  if (newRound) {
    picked.value = null
    locked.value = false
    answeredLocal.value = false
    roundSeconds.value = 0
  }
  roundSeconds.value = Math.max(roundSeconds.value, v.secondsLeft)
  failed.value = false
  if (v.status !== 'active' || v.phase === 'finished' || v.result) stopTimers()
  else if (tick === null) startTick()
}

/** One read of the view (the poll and the phase deadlines). Failures keep the current screen. */
async function pollOnce(): Promise<void> {
  if (polling) return
  polling = true
  lastFetchAt = clock.now()
  const id = uuid.value
  try {
    const v = await fetchArena(id)
    if (id === uuid.value) applyView(v)
  } catch {
    // ERR-NET-01: the round continues server-side; the next tick reads the view again
  } finally {
    polling = false
  }
}

function startTick(): void {
  stopTimers()
  lastFetchAt = clock.now()
  tick = setInterval(() => {
    nowMs.value = clock.now()
    const dl = deadlineMs.value
    const deadlineHit = dl !== null && nowMs.value >= dl && lastFetchAt < dl
    if (deadlineHit || nowMs.value - lastFetchAt >= BATTLE_POLL_MS) void pollOnce()
  }, TICK_MS)
}

watch(data, (v) => {
  if (!v) return
  view.value = null
  applyView(v)
})

onBeforeUnmount(stopTimers)

const title = computed(() => {
  const r = result.value
  const v = view.value
  if (!r || !v) return ''
  if (v.status === 'abandoned') return BATTLE_MSG.resultAbandoned
  const won = r.winner === you.value
  if (v.status === 'forfeited') {
    return won ? BATTLE_MSG.resultOpponentForfeit : BATTLE_MSG.resultOwnForfeit
  }
  if (r.winner === null) return BATTLE_MSG.resultDraw
  return won ? BATTLE_MSG.resultWin : BATTLE_MSG.resultLose
})
/** The tone of the result: `win`, `lose`, or `neutral` (draw, abandoned). */
const tone = computed<'win' | 'lose' | 'neutral'>(() => {
  const r = result.value
  const v = view.value
  if (!r || !v || v.status === 'abandoned') return 'neutral'
  const w: Winner = r.winner
  if (w === null) return 'neutral'
  return w === you.value ? 'win' : 'lose'
})

async function submit(optionId: number | null): Promise<void> {
  const q = question.value
  if (locked.value || answered.value || !q || phase.value !== 'answering') return
  locked.value = true
  picked.value = optionId
  const sinceView = Math.floor((clock.now() - viewAt.value) / 1000)
  const seconds = Math.min(
    MAX_SECONDS,
    Math.max(0, roundSeconds.value - (view.value?.secondsLeft ?? 0) + sinceView),
  )
  try {
    await answerArena(uuid.value, { questionId: q.id, optionId, seconds })
    answeredLocal.value = true
    locked.value = false
    // the response says only "accepted": read the view for the phase (and the key at reveal)
    await pollOnce()
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
  const yes = await confirm({
    title: BATTLE_MSG.forfeitTitle,
    message: BATTLE_MSG.forfeitBody,
    confirmLabel: BATTLE_MSG.forfeit,
    cancelLabel: BATTLE_MSG.keepPlaying,
    tone: 'error',
  })
  if (!yes) return
  stopTimers()
  try {
    await forfeitBattle(uuid.value)
    await reload()
  } catch {
    alertNative(BATTLE_MSG.forfeitNetwork)
    if (view.value?.status === 'active' && question.value) startTick()
  }
}

/** Option state: the key and both picks at reveal, the own pick while waiting, else idle. */
function optionState(id: number): 'idle' | 'selected' | 'correct' | 'wrong' | 'dimmed' {
  const r = reveal.value
  if (r) {
    if (id === r.correctOptionId) return 'correct'
    if (id === r.you.optionId) return 'wrong'
    return 'dimmed'
  }
  if (answered.value || locked.value) return id === picked.value ? 'selected' : 'dimmed'
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
            <UBadge
              v-if="view.players[side].isBot"
              color="neutral"
              variant="soft"
              size="sm"
              :data-testid="`battle-arena-robot-${side}`"
              >Latihan</UBadge
            >
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

      <!-- Playing: answering, waiting for the opponent, or the reveal of the round -->
      <UCard v-if="phase !== 'finished' && question" data-testid="battle-arena-question">
        <div class="flex flex-col gap-3">
          <div class="flex items-center justify-between text-label text-toned">
            <span data-testid="battle-arena-progress">Soalan {{ view.index }}/{{ view.total }}</span>
            <span v-if="phase === 'answering'" class="tabular" data-testid="battle-arena-seconds"
              >{{ remaining }}s</span
            >
          </div>
          <UProgress
            v-if="phase === 'answering'"
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
          <!-- Waiting for the opponent -->
          <DsText
            v-if="phase === 'answering' && answered"
            as="div"
            variant="label"
            tone="muted"
            aria-busy="true"
            data-testid="battle-arena-waiting"
          >
            <DsCluster justify="center" gap="xs">
              <UIcon name="i-ph-hourglass-duotone" class="size-6" aria-hidden="true" />
              <span>{{ BATTLE_MSG.waitingOpponent }}</span>
            </DsCluster>
          </DsText>
          <p
            v-if="reveal"
            class="text-center text-label"
            :class="reveal.you.correct ? 'text-success' : 'text-error'"
            data-testid="battle-arena-feedback"
          >
            {{ reveal.you.correct ? `+${reveal.you.points}` : '+0' }}
            <span class="ms-2 text-muted" data-testid="battle-arena-opponent">
              Lawan: {{ reveal.opponent.correct ? 'betul' : 'salah' }} +{{ reveal.opponent.points }}
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
              {{ BATTLE_MSG.forfeit }}
            </UButton>
          </div>
        </div>
      </UCard>

      <!-- Result -->
      <UCard v-else-if="result" data-testid="battle-arena-result">
        <div class="flex flex-col items-center gap-3 text-center">
          <DsArt3D :name="tone === 'win' ? 'trophy' : 'fire'" size="hero" float />
          <h2
            class="text-display"
            :class="tone === 'win' ? 'text-success' : tone === 'lose' ? 'text-error' : 'text-toned'"
            data-testid="battle-arena-title"
          >
            {{ title }}
          </h2>
          <p class="tabular text-heading text-highlighted" data-testid="battle-arena-final">
            {{ result.scoreA }} vs {{ result.scoreB }}
          </p>
          <div class="flex flex-wrap justify-center gap-3">
            <UButton
              v-if="again"
              :to="{ path: '/battle', query: { again: '1' } }"
              size="xl"
              color="primary"
              class="min-h-12"
              data-testid="battle-arena-play-again"
              >{{ BATTLE_MSG.playAgain }}</UButton
            >
            <UButton
              to="/battle"
              size="xl"
              color="primary"
              class="min-h-12"
              data-testid="battle-arena-again"
              >{{ BATTLE_MSG.backToArena }}</UButton
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
