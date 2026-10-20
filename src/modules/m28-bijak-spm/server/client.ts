/**
 * The handle to the Bijak SPM student server. `VITE_API_MODE=http` talks to the real `/api/bijak/*`
 * routes (`./http`); otherwise one persisted in-browser mock per tab (state in localStorage, so
 * attempts survive a refresh). Pages only talk to this, never to the data files.
 *
 * The mock (and its seed registry) is loaded by a top-level `await import()` behind the static env
 * check: Vite replaces `import.meta.env.VITE_API_MODE` with a literal, so the http build drops the
 * branch and never emits the mock chunk.
 */
import { createHttpBijakServer } from './http'
import { MemoryStorage, type KeyValueStore } from './storage'
import type { BijakServer } from './store'
import type { BijakApi } from './types'

const createMock =
  import.meta.env.VITE_API_MODE === 'http'
    ? null
    : (await import('./local-server')).createMockBijakServer

let storage: KeyValueStore | null = null
let instance: BijakApi | null = null

/** Device-side storage for the autosave copy (localStorage, else memory). Same in both modes. */
export function browserStorage(): KeyValueStore {
  if (storage) return storage
  try {
    if (typeof localStorage !== 'undefined') {
      const probe = '__pp_probe__'
      localStorage.setItem(probe, '1')
      localStorage.removeItem(probe)
      storage = localStorage
      return storage
    }
  } catch {
    /* blocked: fall through to memory */
  }
  storage = new MemoryStorage()
  return storage
}

export function bijakServer(): BijakApi {
  instance ??= createMock ? createMock(browserStorage()) : createHttpBijakServer()
  return instance
}

/** Test hook: swap in a server (and its device storage). */
export function setBijakServerForTests(
  server: BijakApi | null,
  deviceStorage?: KeyValueStore,
): void {
  instance = server
  storage = deviceStorage ?? null
}

/** Dev / e2e hook: `window.__bijak` lets a spec move the clock for the timer tests. */
export interface BijakWindow {
  __bijak?: { server: BijakServer }
}
