/**
 * Online / offline state (40 §X10.3.3, ERR-NET-01 and ERR-NET-03, AC-ERR-4).
 *
 * `status` is `'offline'` when `navigator.onLine` is false, or when two consecutive `NETWORK_ERROR`
 * results arrive within 10 s (`reportNetworkError`). On reconnection it is `'restored'` for 3 s and
 * then `'online'`; the reconnect callbacks (queued retries) run at the moment of reconnection.
 *
 * The state is one shared singleton so every screen sees the same banner. `startOfflineWatch()` is
 * reference counted and idempotent: `DsOfflineBanner` calls it on mount, the client may call
 * `reportNetworkError()` / `reportNetworkOk()` after a request settles.
 */
import { readonly, ref } from 'vue'

export type ConnectionStatus = 'online' | 'offline' | 'restored'

export const OFFLINE_MESSAGE_BM = 'Anda sedang luar talian. Semak sambungan internet anda.'
export const RESTORED_MESSAGE_BM = 'Sambungan dipulihkan.'

/** Two `NETWORK_ERROR` results inside this window count as offline. */
export const NETWORK_ERROR_WINDOW_MS = 10_000
/** How long "Sambungan dipulihkan." stays visible. */
export const RESTORED_VISIBLE_MS = 3_000

const state = ref<ConnectionStatus>('online')
/** Offline was set by `navigator.onLine` (true) rather than by repeated network errors. */
let browserOffline = false
let lastNetworkErrorAt: number | null = null
let restoredTimer: ReturnType<typeof setTimeout> | undefined
let watchers = 0
const reconnectHandlers = new Set<() => void>()

function clearRestoredTimer(): void {
  if (restoredTimer !== undefined) {
    clearTimeout(restoredTimer)
    restoredTimer = undefined
  }
}

function goOffline(): void {
  clearRestoredTimer()
  state.value = 'offline'
}

function goOnline(): void {
  if (state.value !== 'offline') return
  state.value = 'restored'
  lastNetworkErrorAt = null
  for (const handler of [...reconnectHandlers]) {
    try {
      handler()
    } catch {
      // A failing retry must not block the others or the banner.
    }
  }
  clearRestoredTimer()
  restoredTimer = setTimeout(() => {
    restoredTimer = undefined
    if (state.value === 'restored') state.value = 'online'
  }, RESTORED_VISIBLE_MS)
}

function onBrowserOffline(): void {
  browserOffline = true
  goOffline()
}

function onBrowserOnline(): void {
  browserOffline = false
  goOnline()
}

/**
 * Call when a request ended in `NETWORK_ERROR` (no response; a client timeout counts). The second
 * one within 10 s switches the state to offline.
 */
export function reportNetworkError(now: number = Date.now()): void {
  if (lastNetworkErrorAt !== null && now - lastNetworkErrorAt <= NETWORK_ERROR_WINDOW_MS) {
    goOffline()
  }
  lastNetworkErrorAt = now
}

/** Call when any request got a response: the network works, so error-driven offline ends. */
export function reportNetworkOk(): void {
  lastNetworkErrorAt = null
  if (!browserOffline) goOnline()
}

/** Runs `handler` when the connection returns (queued retries). Returns the unsubscribe function. */
export function onReconnect(handler: () => void): () => void {
  reconnectHandlers.add(handler)
  return () => {
    reconnectHandlers.delete(handler)
  }
}

/** Starts listening to `online` / `offline`. Returns a stop function; safe to call many times. */
export function startOfflineWatch(): () => void {
  if (typeof window === 'undefined') return () => {}
  if (watchers === 0) {
    window.addEventListener('offline', onBrowserOffline)
    window.addEventListener('online', onBrowserOnline)
    if (typeof navigator !== 'undefined' && navigator.onLine === false) onBrowserOffline()
  }
  watchers += 1
  let stopped = false
  return () => {
    if (stopped) return
    stopped = true
    watchers -= 1
    if (watchers === 0) {
      window.removeEventListener('offline', onBrowserOffline)
      window.removeEventListener('online', onBrowserOnline)
    }
  }
}

/** Reactive, read-only connection status for components. */
export function useOffline() {
  return { status: readonly(state), startOfflineWatch }
}

/** Test helper: back to the initial state with no listeners or handlers. */
export function resetOfflineForTests(): void {
  clearRestoredTimer()
  if (typeof window !== 'undefined') {
    window.removeEventListener('offline', onBrowserOffline)
    window.removeEventListener('online', onBrowserOnline)
  }
  watchers = 0
  browserOffline = false
  lastNetworkErrorAt = null
  reconnectHandlers.clear()
  state.value = 'online'
}
