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
 * of #25, so a link to an open room (the hub strip) opens it.
 */
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'

import { setRouteOutcome } from '@/app/router/outcome'
import { AlertBox, LoadingSpinner } from '@/components/feedback'
import { useFlash, useSession } from '@/composables'

import { fetchRoom, joinRoom, roomAction, startRoom, type RoomGame, type RoomView } from '../api'
import {
  LOAD_ERROR,
  ROOM_GAME_META,
  ROOM_NOT_FOUND,
  lobbyPath,
} from '../components/lobby/lobby-config'
import { clock, errorLines, isNotFoundError, teamLabel } from '../components/lobby/lobby-lib'
import RoomBoard from '../components/lobby/RoomBoard.vue'
import RoomPlayers from '../components/lobby/RoomPlayers.vue'
import RoomQuestionCard from '../components/lobby/RoomQuestionCard.vue'
import {
  CROSSWORD_SECONDS,
  PF_ROUND_SECONDS,
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
const now = ref(Date.now())
let questionKey = ''
let shownAt = Date.now()
let playStartedAt = 0
let crosswordClosing = false

function setRoom(v: RoomView): void {
  room.value = v
  const key = `${v.status}:${String(v.question?.id ?? '')}:${String(v.round ?? '')}`
  if (key !== questionKey) {
    questionKey = key
    shownAt = Date.now()
    now.value = shownAt
  }
  if (v.status === 'playing' && playStartedAt === 0) playStartedAt = Date.now()
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

// A 1 s tick for the round countdown (Perang Fakta) and the crossword clock; cleared on unmount.
const ticker = setInterval(() => {
  now.value = Date.now()
}, 1000)

const initCtl = new AbortController()
onBeforeUnmount(() => {
  clearInterval(ticker)
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

async function act(call: () => Promise<RoomView>): Promise<void> {
  if (acting.value) return
  acting.value = true
  actionErrors.value = []
  poller.abortInFlight()
  version += 1
  try {
    setRoom(await call())
  } catch (err) {
    actionErrors.value = errorLines(err)
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
  const seconds = answerSeconds(shownAt, Date.now())
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

const countdown = computed<string | null>(() => {
  if (props.game !== 'perang-fakta' || room.value?.status !== 'playing') return null
  const left = PF_ROUND_SECONDS - Math.floor((now.value - shownAt) / 1000)
  return `${String(Math.max(0, left))}s`
})

const crosswordLeft = computed(() =>
  props.game === 'teka-silang-kata' && room.value?.status === 'playing' && playStartedAt > 0
    ? CROSSWORD_SECONDS - Math.floor((now.value - playStartedAt) / 1000)
    : null,
)

// Teka Silang Kata: at 0:00 the remaining words are left empty, which ends the game.
watch(crosswordLeft, async (left) => {
  if (left === null || left > 0 || !acts.value || crosswordClosing) return
  crosswordClosing = true
  try {
    for (let i = 0; i < 20; i++) {
      const r = room.value
      if (!r || r.status !== 'playing' || !r.question) break
      await act(() => roomAction(props.game, code.value, answerBody(r.question!.id, { value: '' }, 15)))
      if (actionErrors.value.length > 0) break
    }
  } finally {
    crosswordClosing = false
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
      label: r.game === 'benteng-ilmu' ? `HP ${String(Math.max(0, value))}` : `${String(value)}/20 langkah`,
      barClass: r.game === 'benteng-ilmu' ? 'bg-emerald-500' : 'bg-indigo-500',
    }
  })
})
</script>

<template>
  <div class="mx-auto max-w-5xl space-y-4 sm:space-y-6" data-testid="room-page">
    <div
      v-if="phase === 'loading'"
      class="flex justify-center py-16 text-indigo-500"
      data-testid="room-loading"
    >
      <LoadingSpinner :size="32" />
    </div>
    <AlertBox v-else-if="phase === 'error'" :messages="LOAD_ERROR" data-testid="room-error" />
    <template v-else-if="room">
      <header class="rounded-2xl bg-white p-5 shadow sm:p-6">
        <h1 class="font-heading text-2xl font-bold text-slate-800 sm:text-3xl" data-testid="room-h1">
          {{ meta.emoji }} {{ meta.title }}
        </h1>
        <p class="mt-1 text-sm text-slate-500" data-testid="room-code">
          Kod Bilik: <span class="font-mono font-bold text-indigo-600">{{ room.code }}</span>
        </p>
      </header>

      <AlertBox :messages="actionErrors" data-testid="room-action-errors" />

      <div class="grid gap-4 md:grid-cols-3 sm:gap-6">
        <RoomPlayers
          class="md:order-2"
          :room="room"
          :show-metric="room.status === 'playing' || room.status === 'finished'"
        />

        <section class="space-y-4 rounded-2xl bg-white p-5 shadow md:order-1 md:col-span-2 sm:p-6">
          <!-- waiting -->
          <div v-if="room.status === 'waiting'" class="space-y-3" data-testid="room-waiting">
            <p class="text-sm text-slate-600" data-testid="room-waiting-count">
              Menunggu pemain... {{ room.players.length }}/{{ room.settings.maxPlayers }} (minimum
              {{ room.settings.minPlayers }})
            </p>
            <button
              v-if="isHost"
              type="button"
              :disabled="!startable || acting"
              class="bg-save-gradient inline-flex min-h-11 items-center justify-center rounded-xl px-6 py-2.5 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
              data-testid="room-start"
              @click="start"
            >
              Mula
            </button>
            <p v-else class="text-sm font-semibold text-slate-500" data-testid="room-wait-host">
              Menunggu hos memulakan permainan
            </p>
          </div>

          <!-- playing -->
          <div v-else-if="room.status === 'playing'" class="space-y-4" data-testid="room-playing">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <p v-if="round" class="text-sm font-bold text-indigo-600" data-testid="room-round">
                {{ round }}
              </p>
              <p
                v-if="crosswordLeft !== null"
                class="text-sm font-bold text-slate-600"
                data-testid="room-clock"
              >
                ⏱️ {{ clock(crosswordLeft) }}
              </p>
            </div>

            <RoomBoard v-if="game === 'papan-bijak' && room.state?.board" :board="room.state.board" :room="room" />

            <div v-if="meters.length > 0" class="space-y-2" data-testid="room-meters">
              <div v-for="m in meters" :key="m.id" data-testid="room-meter">
                <div class="flex justify-between text-xs font-semibold text-slate-600">
                  <span class="min-w-0 break-words">{{ m.name }}</span>
                  <span>{{ m.label }}</span>
                </div>
                <div class="mt-1 h-2.5 overflow-hidden rounded-full bg-slate-100">
                  <div class="h-full rounded-full" :class="m.barClass" :style="{ width: `${String(m.percent)}%` }"></div>
                </div>
              </div>
            </div>

            <p
              v-if="game === 'kuiz-relay' && room.state?.teamScores"
              class="text-sm font-semibold text-slate-700"
              data-testid="room-team-scores"
            >
              <span v-for="(score, team) in room.state.teamScores" :key="team" class="mr-4"
                >Pasukan {{ teamLabel(Number(team)) }}: {{ score }}</span
              >
            </p>

            <template v-if="acts">
              <div v-if="awaiting === 'roll'" class="space-y-2">
                <button
                  type="button"
                  :disabled="acting"
                  class="bg-primary-gradient inline-flex min-h-11 items-center justify-center rounded-xl px-6 py-2.5 text-sm font-bold text-white disabled:cursor-wait disabled:opacity-60"
                  data-testid="room-roll"
                  @click="roll"
                >
                  🎲 Gulung Dadu
                </button>
                <p v-if="dice !== null" class="text-sm text-slate-600" data-testid="room-dice">
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
            <p v-else class="text-sm font-semibold text-slate-500" data-testid="room-watching">
              Menunggu pemain lain
            </p>
          </div>

          <!-- finished -->
          <div v-else-if="room.status === 'finished'" class="space-y-4" data-testid="room-result">
            <p
              class="font-heading text-xl font-bold text-slate-800"
              data-testid="room-result-title"
            >
              {{ headline?.title }}
            </p>
            <p v-if="headline?.mvp" class="text-sm font-semibold text-indigo-600" data-testid="room-mvp">
              {{ headline.mvp }}
            </p>
            <ul v-if="room.result" class="divide-y divide-slate-100" data-testid="room-scores">
              <li
                v-for="s in room.result.scores"
                :key="s.userId"
                class="flex justify-between gap-3 py-2 text-sm"
              >
                <span class="min-w-0 break-words text-slate-700">{{ s.name }}</span>
                <span class="shrink-0 font-bold text-slate-800">{{ s.points }} mata</span>
              </li>
            </ul>
            <RouterLink
              to="/permainan"
              class="bg-primary-gradient inline-flex min-h-11 items-center justify-center rounded-xl px-6 py-2.5 text-sm font-bold text-white"
              data-testid="room-hub"
            >
              🎮 Hub
            </RouterLink>
          </div>

          <!-- closed (seed rooms) -->
          <div v-else class="space-y-3" data-testid="room-closed">
            <p class="text-sm font-semibold text-slate-600">Bilik ini telah ditutup.</p>
            <RouterLink
              to="/permainan"
              class="bg-primary-gradient inline-flex min-h-11 items-center justify-center rounded-xl px-6 py-2.5 text-sm font-bold text-white"
              >🎮 Hub</RouterLink
            >
          </div>
        </section>
      </div>
    </template>
  </div>
</template>
