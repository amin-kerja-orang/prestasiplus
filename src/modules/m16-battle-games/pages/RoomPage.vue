<script setup lang="ts">
/**
 * `/papan-bijak/:code` and `/{game}/:code` rooms (SRS M16 v1.6 FR-M16-66..70; URS FT-M16-5.5; PROVISIONAL,
 * M16-T4). The waiting room, the play area of the six games and the result, from `GET
 * /api/games/{game}/rooms/{code}` (#26), polled every `BATTLE_POLL_MS` while the room is open (§7.1:
 * `useRoomPolling` skips a tick while a request runs, aborts on leaving and clears its timer). The host
 * starts (#27); the acting player rolls or answers (#28). Opponents are the deterministic bots of the mock.
 *
 * An unknown code (or a room the viewer cannot join) is the 404 page for Papan Bijak and the lobby with the
 * flash "Bilik tidak dijumpai." for S8–S12 (DV-M16-07). A direct visit by a non-player first tries the join
 * of #25, so a link to an open room (the hub strip) opens it. INFERRED: no live behaviour is observed for a
 * bare room link; the join-on-visit is this page's reading of "chip linking to the room" (FN-M16-4.1.2).
 *
 * Clocks: Perang Fakta (10 s a round) and Teka Silang Kata (5 minutes) run on the server; see `setRoom`.
 */
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { useRouter } from 'vue-router'

import { setRouteOutcome } from '@/app/router/outcome'
import { useFlash, useSession } from '@/composables'
import { DsArt3D, DsLeaderRow, DsPage } from '@/ds'

import { fetchRoom, joinRoom, roomAction, startRoom, type RoomGame, type RoomView } from '../api'
import {
  LOAD_ERROR,
  ROOM_GAME_META,
  ROOM_NOT_FOUND,
  ROOM_THEME,
  lobbyPath,
} from '../components/lobby/lobby-config'
import { clock, errorLines, isNotFoundError, teamLabel } from '../components/lobby/lobby-lib'
import RoomBoard from '../components/lobby/RoomBoard.vue'
import RoomPlayers from '../components/lobby/RoomPlayers.vue'
import RoomQuestionCard from '../components/lobby/RoomQuestionCard.vue'
import {
  answerBody,
  answerSeconds,
  canAct as canActIn,
  canStart as canStartIn,
  isHost as isHostIn,
  isOpenRoom,
  lastRoll,
  questionMode,
  resultHeadline,
  roundText,
} from '../components/lobby/room-lib'
import { useRoomPolling } from '../composables/useRoomPolling'

const props = defineProps<{ game: RoomGame; code: string }>()

const meta = computed(() => ROOM_GAME_META[props.game])
const theme = computed(() => ROOM_THEME[props.game])
const code = computed(() => props.code.trim().toUpperCase())

const router = useRouter()
const flash = useFlash()
const { user } = useSession()
const userId = computed(() => user.value?.id ?? null)

const room = shallowRef<RoomView | null>(null)
const phase = ref<'loading' | 'ready' | 'error'>('loading')
const acting = ref(false)
const actionErrors = ref<string[]>([])

/** Bumped by every action so an older poll answer never overwrites a newer state. */
let version = 0
/**
 * The clocks come from the server (BR-M16-20): every answer of #26 / #27 / #28 carries `roundSecondsLeft`
 * (Perang Fakta) or `secondsLeft` (Teka Silang Kata). The page only counts whole seconds since the last
 * answer (`sinceSync`) and since the question appeared (`sinceQuestion`); a reload or a poll resyncs it.
 * There is no `Date.now()` clock here.
 */
const sinceSync = ref(0)
const sinceQuestion = ref(0)
let questionKey = ''
let timeoutSentFor = ''

function setRoom(v: RoomView): void {
  room.value = v
  sinceSync.value = 0
  const key = `${v.status}:${String(v.question?.id ?? '')}:${String(v.round ?? '')}`
  if (key !== questionKey) {
    questionKey = key
    sinceQuestion.value = 0
  }
}

// --- polling (#26 every 3 s while the room is open) -----------------------------------------------------------------

const poller = useRoomPolling(async (signal) => {
  if (acting.value) return
  const seen = version
  const v = await fetchRoom(props.game, code.value, { signal })
  if (seen !== version || acting.value) return
  setRoom(v)
})

watch(room, (r) => {
  if (r && !isOpenRoom(r)) poller.stop()
})

// A 1 s tick between polls, only while the game plays; cleared when it ends and on unmount.
let ticker: ReturnType<typeof setInterval> | null = null

function stopTicker(): void {
  if (ticker !== null) clearInterval(ticker)
  ticker = null
}

watch(
  () => room.value?.status,
  (status) => {
    if (status === 'playing') {
      if (ticker === null) {
        ticker = setInterval(() => {
          sinceSync.value += 1
          sinceQuestion.value += 1
        }, 1000)
      }
    } else stopTicker()
  },
  { immediate: true },
)

const initCtl = new AbortController()
onBeforeUnmount(() => {
  stopTicker()
  initCtl.abort()
  poller.stop()
})

function leaveNotFound(): void {
  if (props.game === 'papan-bijak') {
    setRouteOutcome(404)
    return
  }
  flash.error(ROOM_NOT_FOUND)
  void router.replace(lobbyPath(props.game))
}

async function init(): Promise<void> {
  try {
    setRoom(await fetchRoom(props.game, code.value, { signal: initCtl.signal }))
  } catch (err) {
    if (initCtl.signal.aborted) return
    if (!isNotFoundError(err)) {
      phase.value = 'error'
      return
    }
    try {
      await joinRoom(props.game, code.value)
      setRoom(await fetchRoom(props.game, code.value, { signal: initCtl.signal }))
    } catch {
      if (!initCtl.signal.aborted) leaveNotFound()
      return
    }
  }
  phase.value = 'ready'
  if (room.value && isOpenRoom(room.value)) poller.start()
}
void init()

// --- actions ----------------------------------------------------------------------------------------------------------

async function act(call: () => Promise<RoomView>, quiet = false): Promise<void> {
  if (acting.value) return
  acting.value = true
  actionErrors.value = []
  poller.abortInFlight()
  version += 1
  try {
    setRoom(await call())
  } catch (err) {
    // A timeout submit can lose the race with the server clock; the next poll resyncs, so say nothing.
    if (!quiet) actionErrors.value = errorLines(err)
  } finally {
    acting.value = false
    version += 1
  }
}

const start = (): Promise<void> => act(() => startRoom(props.game, code.value))
const roll = (): Promise<void> => act(() => roomAction(props.game, code.value, { type: 'roll' }))

function onAnswer(answer: { optionId?: number; value?: string }): Promise<void> {
  const q = room.value?.question
  if (!q) return Promise.resolve()
  const seconds = answerSeconds(sinceQuestion.value)
  return act(() => roomAction(props.game, code.value, answerBody(q.id, answer, seconds)))
}

// --- derived state ----------------------------------------------------------------------------------------------------

const isHost = computed(() => (room.value ? isHostIn(room.value, userId.value) : false))
const acts = computed(() => (room.value ? canActIn(room.value, userId.value) : false))
const startable = computed(() => (room.value ? canStartIn(room.value) : false))
const headline = computed(() => (room.value ? resultHeadline(room.value) : null))
const round = computed(() => (room.value ? roundText(room.value) : ''))
const dice = computed(() => lastRoll(room.value?.state?.log))
const awaiting = computed(() => room.value?.state?.awaiting ?? null)

/** Seconds left of the Perang Fakta round: the server value minus the seconds counted since it arrived. */
const roundLeft = computed<number | null>(() => {
  const left = room.value?.state?.roundSecondsLeft
  return room.value?.status === 'playing' && left !== undefined
    ? Math.max(0, left - sinceSync.value)
    : null
})
const countdown = computed<string | null>(() =>
  roundLeft.value === null ? null : `${String(roundLeft.value)}s`,
)

/** Seconds left of the Teka Silang Kata game (server clock). */
const crosswordLeft = computed<number | null>(() => {
  const left = room.value?.state?.secondsLeft
  return room.value?.status === 'playing' && left !== undefined
    ? Math.max(0, left - sinceSync.value)
    : null
})

// Perang Fakta: when the round clock reaches 0 the acting player sends the explicit no-vote (#28,
// `optionId: null`, 0 s). The server resolves the same timeout on its own at the next poll, so a lost race
// is harmless and silent.
watch(roundLeft, (left) => {
  const r = room.value
  const q = r?.question
  if (left !== 0 || !r || !q || !acts.value || acting.value || r.state?.awaiting !== 'answer')
    return
  const key = `${r.code}:${String(q.id)}`
  if (timeoutSentFor === key) return
  timeoutSentFor = key
  void act(() => roomAction(props.game, code.value, answerBody(q.id, {}, 0)), true)
})

// Teka Silang Kata: at 0:00 the server ends the game; ask for the answer at once instead of waiting.
watch(crosswordLeft, (left) => {
  if (left === 0 && !acting.value) {
    void fetchRoom(props.game, code.value, { signal: initCtl.signal })
      .then((v) => {
        if (!acting.value) setRoom(v)
      })
      .catch(() => undefined)
  }
})

const meters = computed(() => {
  const r = room.value
  if (!r?.state?.meter) return []
  const max = r.game === 'benteng-ilmu' ? 100 : r.game === 'perlumbaan-matematik' ? 20 : 0
  if (max === 0) return []
  return r.players.map((p) => {
    const value = r.state?.meter?.[String(p.id)] ?? (r.game === 'benteng-ilmu' ? 100 : 0)
    return {
      id: p.id,
      name: p.name,
      value: Math.max(0, value),
      percent: Math.max(0, Math.min(100, Math.round((value / max) * 100))),
      label:
        r.game === 'benteng-ilmu'
          ? `HP ${String(Math.max(0, value))}`
          : `${String(value)}/20 langkah`,
      color: r.game === 'benteng-ilmu' ? ('success' as const) : ('primary' as const),
    }
  })
})
</script>

<template>
  <DsPage data-testid="room-page">
    <div v-if="phase === 'loading'" class="flex flex-col gap-4" aria-busy="true" data-testid="room-loading">
      <USkeleton class="h-28 w-full" />
      <USkeleton class="h-40 w-full" />
    </div>
    <UAlert
      v-else-if="phase === 'error'"
      color="error"
      variant="subtle"
      :title="LOAD_ERROR"
      data-testid="room-error"
    />
    <template v-else-if="room">
      <UCard>
        <div class="flex items-center justify-between gap-4">
          <div class="flex min-w-0 flex-col gap-1">
            <h1 class="text-title text-highlighted" data-testid="room-h1">
              {{ meta.emoji }} {{ meta.title }}
            </h1>
            <p class="text-body text-muted" data-testid="room-code">
              Kod Bilik: <span class="tabular text-heading text-primary-t">{{ room.code }}</span>
            </p>
          </div>
          <DsArt3D :name="theme.art" size="hero" float class="hidden sm:block" />
        </div>
      </UCard>

      <UAlert
        v-if="actionErrors.length > 0"
        color="error"
        variant="subtle"
        icon="i-ph-warning-circle-duotone"
        data-testid="room-action-errors"
      >
        <template #description>
          <ul class="flex flex-col gap-1">
            <li v-for="line in actionErrors" :key="line">{{ line }}</li>
          </ul>
        </template>
      </UAlert>

      <div class="grid gap-4 md:grid-cols-3 md:gap-6">
        <RoomPlayers
          class="md:order-2"
          :room="room"
          :show-metric="room.status === 'playing' || room.status === 'finished'"
        />

        <UCard class="md:order-1 md:col-span-2">
          <!-- waiting -->
          <div v-if="room.status === 'waiting'" class="flex flex-col gap-3" data-testid="room-waiting">
            <p class="text-body text-muted" data-testid="room-waiting-count">
              Menunggu pemain... {{ room.players.length }}/{{ room.settings.maxPlayers }} (minimum
              {{ room.settings.minPlayers }})
            </p>
            <UButton
              v-if="isHost"
              size="xl"
              color="primary"
              :disabled="!startable || acting"
              class="min-h-12 justify-center sm:self-start"
              data-testid="room-start"
              @click="start"
            >
              Mula
            </UButton>
            <p v-else class="text-label text-muted" data-testid="room-wait-host">
              Menunggu hos memulakan permainan
            </p>
          </div>

          <!-- playing -->
          <div v-else-if="room.status === 'playing'" class="flex flex-col gap-4" data-testid="room-playing">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <p v-if="round" class="text-label text-primary-t" data-testid="room-round">
                {{ round }}
              </p>
              <p
                v-if="crosswordLeft !== null"
                class="tabular text-label text-toned"
                data-testid="room-clock"
              >
                ⏱️ {{ clock(crosswordLeft) }}
              </p>
            </div>

            <RoomBoard
              v-if="game === 'papan-bijak' && room.state?.board"
              :board="room.state.board"
              :room="room"
            />

            <div v-if="meters.length > 0" class="flex flex-col gap-3" data-testid="room-meters">
              <div v-for="m in meters" :key="m.id" data-testid="room-meter">
                <div class="flex justify-between gap-2 text-caption text-toned">
                  <span class="min-w-0 break-words">{{ m.name }}</span>
                  <span class="tabular">{{ m.label }}</span>
                </div>
                <UProgress :model-value="m.percent" :color="m.color" size="md" class="mt-1" />
              </div>
            </div>

            <p
              v-if="game === 'kuiz-relay' && room.state?.teamScores"
              class="text-label text-toned"
              data-testid="room-team-scores"
            >
              <span v-for="(score, team) in room.state.teamScores" :key="team" class="me-4"
                >Pasukan {{ teamLabel(Number(team)) }}: {{ score }}</span
              >
            </p>

            <template v-if="acts">
              <div v-if="awaiting === 'roll'" class="flex flex-col gap-2">
                <UButton
                  size="xl"
                  color="primary"
                  :disabled="acting"
                  class="min-h-12 justify-center sm:self-start"
                  data-testid="room-roll"
                  @click="roll"
                >
                  🎲 Gulung Dadu
                </UButton>
                <p v-if="dice !== null" class="text-body text-muted" data-testid="room-dice">
                  🎲 Dadu: {{ dice }}
                </p>
              </div>
              <RoomQuestionCard
                v-else-if="awaiting === 'answer' && room.question"
                :question="room.question"
                :mode="questionMode(room)"
                :busy="acting"
                :disabled="false"
                :countdown="countdown"
                @answer="onAnswer"
              />
            </template>
            <p v-else class="text-label text-muted" data-testid="room-watching">
              Menunggu pemain lain
            </p>
          </div>

          <!-- finished -->
          <div v-else-if="room.status === 'finished'" class="flex flex-col gap-4" data-testid="room-result">
            <div class="flex items-center gap-3">
              <DsArt3D name="trophy" size="xl" float />
              <p class="text-title text-highlighted" data-testid="room-result-title">
                {{ headline?.title }}
              </p>
            </div>
            <p v-if="headline?.mvp" class="text-label text-primary-t" data-testid="room-mvp">
              {{ headline.mvp }}
            </p>
            <ul v-if="room.result" class="flex flex-col gap-2" data-testid="room-scores">
              <DsLeaderRow
                v-for="(s, i) in room.result.scores"
                :key="s.userId"
                :rank="i + 1"
                :name="s.name"
                :points="s.points"
                unit="mata"
                medal="trophy"
              />
            </ul>
            <UButton
              to="/permainan"
              size="xl"
              color="primary"
              class="min-h-12 justify-center sm:self-start"
              data-testid="room-hub"
            >
              🎮 Hab
            </UButton>
          </div>

          <!-- closed (seed rooms) -->
          <div v-else class="flex flex-col gap-3" data-testid="room-closed">
            <p class="text-label text-toned">Bilik ini telah ditutup.</p>
            <UButton to="/permainan" size="xl" color="primary" class="min-h-12 justify-center sm:self-start"
              >🎮 Hab</UButton
            >
          </div>
        </UCard>
      </div>
    </template>
  </DsPage>
</template>
