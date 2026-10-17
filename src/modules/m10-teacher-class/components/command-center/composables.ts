/**
 * Timers and small helpers of S2 (SRS M10 NFR-M10-02: the clock and the poll are cleared when the page
 * is left; tests drive them with fake timers).
 */
import { onScopeDispose, ref, shallowRef, watch, type Ref } from 'vue'
import { useRouter } from 'vue-router'

import { useIntervalWhileVisible } from '@/composables'
import { formatCount } from '@/lib/number'
import { formatMyt } from '@/lib/time'

import { COMMAND_CENTER_POLL_MS, fetchCommandCenterLiveData } from '../../api/command-center'
import type { CcLiveData } from '../../api/command-center-types'

/** `HH:MM:SS` in Asia/Kuala_Lumpur, ticking every second (FR-M10-14). */
export function useClock(): Ref<string> {
  const now = () => formatMyt(Date.now(), 'HH:mm:ss')
  const text = ref(now())
  const timer = setInterval(() => {
    text.value = now()
  }, 1000)
  onScopeDispose(() => {
    clearInterval(timer)
  })
  return text
}

/**
 * Loads `live-data` on mount and every 10 s (FR-M10-15). A failed poll keeps the previous values and
 * logs "Fetch error:" (the live behaviour).
 */
export function useLiveData() {
  const data = shallowRef<CcLiveData | null>(null)
  let controller: AbortController | null = null
  let inFlight = false
  const paused = ref(false)

  async function load(): Promise<void> {
    // a tick while a request is still running is skipped, so a slow response still lands
    if (inFlight || paused.value) return
    inFlight = true
    const current = new AbortController()
    controller = current
    try {
      const result = await fetchCommandCenterLiveData({ signal: current.signal })
      if (!current.signal.aborted) data.value = result
    } catch (err) {
      if (current.signal.aborted) return
      console.error('Fetch error:', err)
    } finally {
      inFlight = false
    }
  }

  useIntervalWhileVisible(() => void load(), COMMAND_CENTER_POLL_MS, { immediate: true })
  onScopeDispose(() => {
    controller?.abort()
  })
  const togglePause = (): void => {
    paused.value = !paused.value
    if (!paused.value) void load()
  }
  return { data, paused, togglePause }
}

/**
 * The count of a tile: animates from the previous raw value to the new one and keeps "--" while the
 * raw value is 0 (FR-M10-15, BR-M10-08). `text` is the server's own text, shown when the animation ends.
 */
export function useCountUp(
  raw: Ref<number>,
  text: Ref<string>,
  steps = 15,
  stepMs = 40,
): Ref<string> {
  const shown = ref('--')
  let last = 0
  let timer: ReturnType<typeof setInterval> | null = null
  const stop = () => {
    if (timer !== null) clearInterval(timer)
    timer = null
  }
  watch(
    [raw, text],
    ([value, label]) => {
      stop()
      if (value === 0) {
        last = 0
        shown.value = '--'
        return
      }
      const from = last
      last = value
      if (from === value) {
        shown.value = label
        return
      }
      let i = 0
      timer = setInterval(() => {
        i += 1
        if (i >= steps) {
          stop()
          shown.value = label
        } else {
          shown.value = formatCount(Math.round(from + ((value - from) * i) / steps))
        }
      }, stepMs)
    },
    { immediate: true },
  )
  onScopeDispose(stop)
  return shown
}

/** Opens a page of the Command Center scope in a new tab (FR-M10-19, FR-M10-26). */
export function useOpenTab(): (path: string) => void {
  const router = useRouter()
  return (path) => {
    window.open(router.resolve(path).href, '_blank', 'noopener')
  }
}
