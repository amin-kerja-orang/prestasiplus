/**
 * Timers and loaders of S2 and S3 (SRS M17 FR-M17-20, 21, 34, 35, 36): the counter
 * animation, the 10 s live-data poll and the 30 s daily-activity reload. Everything is cleared when the
 * page is left; tests drive it with fake timers.
 */
import { onScopeDispose, ref, shallowRef, watch, type Ref } from 'vue'

import { isApiError } from '@/api'
import { isHttpMode } from '@/api/mode'
import { setRouteOutcome } from '@/app/router/outcome'
import { useIntervalWhileVisible } from '@/composables'
import { formatCount } from '@/lib/number'

import {
  fetchCcDailyActivity,
  fetchCcLiveData,
  fetchCcSchoolDrill,
  type CcDailyActivity,
  type CcLiveData,
  type CcPeriod,
  type CcSchoolDrill,
} from '../../api/command-center-board'
import { COUNT_UP_MS, S2_COPY, S2_POLL_MS, S2_REQUEST_TIMEOUT_MS, S3_POLL_MS } from './board-copy'

/** A 403 of the first load (a school admin without a school) shows the 403 page; nothing else does. */
function refusedAtFirstLoad(err: unknown, hasData: boolean): boolean {
  return !hasData && isApiError(err) && err.status === 403
}

/**
 * S2 data: loads on mount and every 10 s. A failed poll keeps the previous values and logs
 * "Fetch error:" (FR-M17-21, FR-M17-109). A request still running skips the tick.
 */
export function useLiveBoard() {
  const data = shallowRef<CcLiveData | null>(null)
  /** http mode only: the endpoint is not built yet (404), so polling stopped and the board says so. */
  const unavailable = ref(false)
  let controller: AbortController | null = null
  let inFlight = false

  async function load(): Promise<void> {
    if (inFlight) return
    inFlight = true
    const current = new AbortController()
    controller = current
    // a hung request must not freeze the board: abort it after 15 s so the next tick can run
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      current.abort()
    }, S2_REQUEST_TIMEOUT_MS)
    try {
      const result = await fetchCcLiveData({ signal: current.signal })
      if (!current.signal.aborted) data.value = result
    } catch (err) {
      if (timedOut) console.error('Fetch error:', err)
      if (current.signal.aborted) return
      if (isHttpMode() && isApiError(err) && err.status === 404) {
        unavailable.value = true
        poll.stop()
        return
      }
      if (refusedAtFirstLoad(err, data.value !== null)) setRouteOutcome(403)
      console.error('Fetch error:', err)
    } finally {
      clearTimeout(timer)
      inFlight = false
    }
  }

  const poll = useIntervalWhileVisible(() => void load(), S2_POLL_MS, { immediate: true })
  onScopeDispose(() => {
    controller?.abort()
  })
  return { data, unavailable }
}

export type LoadStatus = 'loading' | 'ok' | 'error'

/**
 * S3 data: the current period, loaded on mount, on a tab click and every 30 s (FR-M17-35, FR-M17-36).
 * The page always starts on "today" (the `?period=` of the URL is ignored). A tab click shows the
 * spinner in the lists; a failed load shows "Gagal memuatkan".
 */
export function useDailyBoard() {
  const period = ref<CcPeriod>('today')
  const data = shallowRef<CcDailyActivity | null>(null)
  const status = ref<LoadStatus>('loading')
  let controller: AbortController | null = null
  let seq = 0

  async function load(): Promise<void> {
    controller?.abort()
    const current = new AbortController()
    controller = current
    const id = ++seq
    try {
      const result = await fetchCcDailyActivity(period.value, { signal: current.signal })
      if (id !== seq) return
      data.value = result
      status.value = 'ok'
    } catch (err) {
      if (id !== seq || current.signal.aborted) return
      if (refusedAtFirstLoad(err, data.value !== null)) setRouteOutcome(403)
      status.value = 'error'
    }
  }

  function setPeriod(next: CcPeriod): void {
    period.value = next
    status.value = 'loading'
    void load()
  }

  useIntervalWhileVisible(() => void load(), S3_POLL_MS, { immediate: true })
  onScopeDispose(() => {
    seq += 1
    controller?.abort()
  })
  return { period, data, status, setPeriod }
}

export interface DrillState {
  schoolId: number | string
  status: LoadStatus
  data: CcSchoolDrill | null
}

/** The school drill of S3 (FR-M17-42): a row click toggles it; a tab click closes it (`close`). */
export function useSchoolDrill(period: Ref<CcPeriod>) {
  const state = ref<DrillState | null>(null)
  let controller: AbortController | null = null
  let token = 0

  function close(): void {
    token += 1
    controller?.abort()
    controller = null
    state.value = null
  }

  async function toggle(schoolId: number | string): Promise<void> {
    if (state.value?.schoolId === schoolId) {
      close()
      return
    }
    controller?.abort()
    const current = new AbortController()
    controller = current
    const mine = ++token
    state.value = { schoolId, status: 'loading', data: null }
    try {
      const result = await fetchCcSchoolDrill(schoolId, period.value, { signal: current.signal })
      if (mine !== token) return
      state.value = { schoolId, status: 'ok', data: result }
    } catch {
      if (mine !== token || current.signal.aborted) return
      state.value = { schoolId, status: 'error', data: null }
    }
  }

  return { state, toggle, close }
}

/**
 * A big counter: animates from the previous value to the new one over 800 ms (cubic ease-out,
 * FR-M17-21) and shows "--" until the first value.
 */
export function useCountUp(target: Ref<number | null>): Ref<string> {
  const shown = ref<string>(S2_COPY.placeholder)
  /** The value on screen now (mid-animation included), the start of an interrupting animation. */
  let shownNow = 0
  let timer: ReturnType<typeof setInterval> | null = null
  const stop = () => {
    if (timer !== null) clearInterval(timer)
    timer = null
  }
  watch(
    target,
    (value) => {
      stop()
      if (value === null) return
      const from = shownNow
      if (from === value) {
        shownNow = value
        shown.value = formatCount(value)
        return
      }
      const start = Date.now()
      timer = setInterval(() => {
        const p = Math.min(1, (Date.now() - start) / COUNT_UP_MS)
        if (p >= 1) {
          stop()
          shownNow = value
          shown.value = formatCount(value)
        } else {
          const eased = 1 - Math.pow(1 - p, 3)
          shownNow = Math.round(from + (value - from) * eased)
          shown.value = formatCount(shownNow)
        }
      }, 40)
    },
    { immediate: true },
  )
  onScopeDispose(stop)
  return shown
}
