/**
 * `useBattleSearch` (SRS M16 v1.6 §7.1, FR-M16-23..29; M16-T3): the S1 matchmaking state machine.
 *
 * - Start #2 / #3 once, then poll #4 every `BATTLE_POLL_MS` with a fixed-rate chain of `setTimeout`s
 *   (never two requests at once; a tick is skipped from the schedule, not queued). The timer text is
 *   set from the elapsed seconds on each poll only.
 * - Stops: `matched` (navigate), `expired` / `not_found`, 120 s since the start, 5 consecutive failed
 *   polls (a success resets the counter). "Batal" stops everything and sends no request.
 * - `incoming_challenge` swaps the card for the challenger card; polling continues.
 * - The waiting side (#12, #13) exists but no UI control starts it (DV-M16-06): `watchWaiting` /
 *   `requestJoin` are reached by the page's test seam only.
 * - Every timer and in-flight request is cleared when the owning scope is disposed.
 */

import { getCurrentScope, onScopeDispose, ref, shallowRef } from 'vue'

import type { RawResponse } from '@/api'
import { clock } from '@/lib/time/clock'

import {
  acceptChallenger,
  BATTLE_MAX_FAILURES,
  BATTLE_POLL_MS,
  BATTLE_SEARCH_TIMEOUT_MS,
  joinQueue,
  pollChallenger,
  pollMatch,
  rejectChallenger,
  startBattle,
  type BattleStartBody,
  type PollChallengerResponse,
  type PollMatchResponse,
} from '../api'
import { BATTLE_MSG, formatMss, rejectedMessage } from '../components/battle/battle-lib'

export type SearchPhase = 'idle' | 'searching' | 'incoming' | 'waiting'

export interface Challenger {
  name: string
  grade_label: string
  school: string
}

function isAbort(err: unknown): boolean {
  return (
    typeof err === 'object' && err !== null && (err as { name?: unknown }).name === 'AbortError'
  )
}

const isOk = (status: number): boolean => status >= 200 && status < 300

function bodyOf<T extends object>(res: RawResponse<unknown>): Partial<T> | null {
  return typeof res.body === 'object' && res.body !== null ? res.body : null
}

export function useBattleSearch(options: { onMatched: (battleUuid: string) => void }) {
  const phase = ref<SearchPhase>('idle')
  const elapsedText = ref('0:00')
  const errorMsg = ref('')
  const loading = ref(false)
  const challenger = shallowRef<Challenger | null>(null)
  const waitingName = ref('')
  const waitingGrade = ref('')

  let session = 0
  let queueId = 0
  let startedAt = 0
  let tickNo = 0
  let failures = 0
  let timer: ReturnType<typeof setTimeout> | null = null
  let controller: AbortController | null = null

  function clearTimer(): void {
    if (timer !== null) clearTimeout(timer)
    timer = null
  }

  /** Ends the current search/wait: timers, in-flight requests, pending results (new `session`). */
  function halt(): void {
    session += 1
    clearTimer()
    controller?.abort()
    controller = null
    loading.value = false
    failures = 0
  }

  function stopWith(message: string): void {
    halt()
    phase.value = 'idle'
    challenger.value = null
    if (message !== '') errorMsg.value = message
  }

  function matched(battleUuid: string): void {
    halt()
    phase.value = 'idle'
    options.onMatched(battleUuid)
  }

  /** Schedules tick `n` at start + n x interval (fixed rate: drift never moves the timer text). */
  function schedule(mySession: number, wait: () => Promise<void>): void {
    const now = clock.now()
    tickNo += 1
    // A response that came after several slots skips the missed ones (no burst of catch-up polls).
    if (startedAt + tickNo * BATTLE_POLL_MS < now) {
      tickNo = Math.ceil((now - startedAt) / BATTLE_POLL_MS)
    }
    const delay = Math.max(0, startedAt + tickNo * BATTLE_POLL_MS - now)
    timer = setTimeout(() => {
      timer = null
      if (mySession === session) void wait()
    }, delay)
  }

  // --- search (#4) -------------------------------------------------------------------------------

  async function searchTick(mySession: number): Promise<void> {
    const elapsedMs = clock.now() - startedAt
    elapsedText.value = formatMss(elapsedMs / 1000)
    if (elapsedMs >= BATTLE_SEARCH_TIMEOUT_MS) {
      stopWith(BATTLE_MSG.noOpponentTimeout)
      return
    }
    const mine = new AbortController()
    controller = mine
    let res: RawResponse<PollMatchResponse>
    try {
      res = await pollMatch(queueId, { signal: mine.signal })
    } catch (err) {
      if (mySession !== session || isAbort(err)) return
      failures += 1
      if (failures >= BATTLE_MAX_FAILURES) stopWith(BATTLE_MSG.repeatedNetwork)
      else schedule(mySession, () => searchTick(mySession))
      return
    }
    if (mySession !== session) return
    if (!isOk(res.status)) {
      failures += 1
      if (failures >= BATTLE_MAX_FAILURES) stopWith(BATTLE_MSG.repeatedError)
      else schedule(mySession, () => searchTick(mySession))
      return
    }
    failures = 0
    const body = bodyOf<PollMatchResponse & { battle_uuid: string; challenger: Challenger }>(res)
    if (body?.status === 'matched' && typeof body.battle_uuid === 'string') {
      matched(body.battle_uuid)
      return
    }
    if (body?.status === 'expired' || body?.status === 'not_found') {
      stopWith(BATTLE_MSG.noOpponent)
      return
    }
    if (body?.status === 'incoming_challenge' && body.challenger) {
      challenger.value = body.challenger
      phase.value = 'incoming'
    }
    schedule(mySession, () => searchTick(mySession))
  }

  /** FN-M16-2.2.3..2.2.5: #2 / #3 once, then the poll loop. */
  async function start(
    mode: 'quick-match' | 'school-battle',
    params: BattleStartBody,
  ): Promise<void> {
    if (loading.value || phase.value !== 'idle') return
    halt()
    const mySession = session
    errorMsg.value = ''
    loading.value = true
    const mine = new AbortController()
    controller = mine
    let res: RawResponse<{
      queue_id?: number
      matched?: boolean
      battle_uuid?: string
      error?: string
      message?: string
    }>
    try {
      res = await startBattle(mode, params, { signal: mine.signal })
    } catch (err) {
      if (mySession !== session || isAbort(err)) return
      loading.value = false
      errorMsg.value = BATTLE_MSG.startNetwork
      return
    }
    if (mySession !== session) return
    loading.value = false
    const body = bodyOf<typeof res.body>(res)
    if (!isOk(res.status)) {
      errorMsg.value = body?.error ?? body?.message ?? BATTLE_MSG.startFallback
      return
    }
    if (body === null) {
      errorMsg.value = BATTLE_MSG.unexpected
      return
    }
    if (body.matched === true && typeof body.battle_uuid === 'string') {
      options.onMatched(body.battle_uuid)
      return
    }
    if (typeof body.queue_id !== 'number' || body.queue_id <= 0) {
      errorMsg.value = BATTLE_MSG.noQueueId
      return
    }
    queueId = body.queue_id
    startedAt = clock.now()
    tickNo = 0
    failures = 0
    elapsedText.value = formatMss(0)
    phase.value = 'searching'
    schedule(mySession, () => searchTick(mySession))
  }

  /** "Batal": resets the page state; no request (DV-M16-05). */
  function cancel(): void {
    stopWith('')
    waitingName.value = ''
    waitingGrade.value = ''
  }

  // --- incoming challenger (#5, #6) --------------------------------------------------------------

  async function respond(accept: boolean): Promise<void> {
    if (phase.value !== 'incoming') return
    const mySession = session
    const mine = new AbortController()
    controller = mine
    try {
      const opts = { signal: mine.signal }
      const res = accept
        ? await acceptChallenger(queueId, opts)
        : await rejectChallenger(queueId, opts)
      if (mySession !== session) return
      const body = bodyOf<{ error: string; matched: boolean; battle_uuid: string }>(res)
      if (body?.error) {
        challenger.value = null
        phase.value = 'searching'
        errorMsg.value = body.error
        return
      }
      if (accept && body?.matched === true && typeof body.battle_uuid === 'string') {
        matched(body.battle_uuid)
        return
      }
      if (!accept) {
        challenger.value = null
        phase.value = 'searching'
      }
    } catch (err) {
      if (mySession !== session || isAbort(err)) return
      errorMsg.value = BATTLE_MSG.challengerNetwork
    }
  }

  // --- waiting for approval (#12, #13; no UI control, DV-M16-06) ---------------------------------

  async function waitTick(mySession: number): Promise<void> {
    const mine = new AbortController()
    controller = mine
    let res: RawResponse<PollChallengerResponse>
    try {
      res = await pollChallenger(queueId, { signal: mine.signal })
    } catch (err) {
      if (mySession !== session || isAbort(err)) return
      stopWith(BATTLE_MSG.waitingNetwork)
      return
    }
    if (mySession !== session) return
    const body = bodyOf<PollChallengerResponse>(res)
    if (!isOk(res.status) || body === null) {
      stopWith(BATTLE_MSG.waitingNetwork)
      return
    }
    if (body.status === 'matched' && typeof body.battle_uuid === 'string') {
      matched(body.battle_uuid)
    } else if (body.status === 'rejected') {
      stopWith(rejectedMessage(waitingName.value))
    } else if (body.status === 'expired' || body.status === 'not_found') {
      stopWith(BATTLE_MSG.leftQueue)
    } else {
      schedule(mySession, () => waitTick(mySession))
    }
  }

  /** Polls #13 every 3 s for a join request already on file. */
  function watchWaiting(id: number, name: string, gradeLabel = ''): void {
    halt()
    const mySession = session
    errorMsg.value = ''
    queueId = id
    waitingName.value = name
    waitingGrade.value = gradeLabel
    startedAt = clock.now()
    tickNo = 0
    phase.value = 'waiting'
    schedule(mySession, () => waitTick(mySession))
  }

  /** `requestJoinQueue`: #12 once, then #13 every 3 s. */
  async function requestJoin(id: number, name: string, gradeLabel = ''): Promise<void> {
    halt()
    const mySession = session
    errorMsg.value = ''
    const mine = new AbortController()
    controller = mine
    try {
      const res = await joinQueue(id, { signal: mine.signal })
      if (mySession !== session) return
      const body = bodyOf<{ error: string }>(res)
      if (!isOk(res.status) || body?.error) {
        errorMsg.value = body?.error ?? BATTLE_MSG.joinError
        return
      }
    } catch (err) {
      if (mySession !== session || isAbort(err)) return
      errorMsg.value = BATTLE_MSG.waitingNetwork
      return
    }
    watchWaiting(id, name, gradeLabel)
  }

  function clearError(): void {
    errorMsg.value = ''
  }

  if (getCurrentScope()) onScopeDispose(halt)

  return {
    phase,
    elapsedText,
    errorMsg,
    loading,
    challenger,
    waitingName,
    waitingGrade,
    start,
    cancel,
    respond,
    watchWaiting,
    requestJoin,
    clearError,
    dispose: halt,
  }
}
