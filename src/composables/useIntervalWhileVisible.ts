/**
 * `useIntervalWhileVisible(fn, ms)` (overview §9): a `setInterval` that runs only while the
 * document is visible. It drives the 60 s bell-badge poll (M01 FR-M01-53) and the 30 s admin
 * server-status poll.
 *
 * - Starts at once (first call after `ms`; `immediate: true` also calls `fn` at start).
 * - Pauses when the tab is hidden (`visibilitychange`) and restarts the interval when it is
 *   visible again (the next call comes `ms` after that).
 * - Stops when the owning component or effect scope is disposed, or on `stop()`.
 */

import { getCurrentScope, onScopeDispose, readonly, ref, type Ref } from 'vue'

export interface IntervalWhileVisibleOptions {
  /** Also call `fn` once at start. Default `false`. */
  immediate?: boolean
}

export interface IntervalWhileVisible {
  /** `true` while the interval is ticking. */
  active: Readonly<Ref<boolean>>
  /** Stops for good (removes the visibility listener). */
  stop: () => void
}

function isVisible(): boolean {
  return typeof document === 'undefined' || document.visibilityState !== 'hidden'
}

export function useIntervalWhileVisible(
  fn: () => void,
  ms: number,
  options: IntervalWhileVisibleOptions = {},
): IntervalWhileVisible {
  let timer: ReturnType<typeof setInterval> | null = null
  let stopped = false
  const active = ref(false)

  const pause = () => {
    if (timer !== null) clearInterval(timer)
    timer = null
    active.value = false
  }

  const resume = () => {
    if (stopped || timer !== null || !isVisible()) return
    timer = setInterval(fn, ms)
    active.value = true
  }

  const onVisibility = () => {
    if (isVisible()) resume()
    else pause()
  }

  const stop = () => {
    stopped = true
    pause()
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibility)
  }
  if (getCurrentScope()) onScopeDispose(stop)

  if (options.immediate) fn()
  resume()

  return { active: readonly(active), stop }
}
