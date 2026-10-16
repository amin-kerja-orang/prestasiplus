/**
 * The browser-side handle to the mock Bijak SPM server: one persisted instance per tab (state in
 * localStorage, so attempts survive a refresh). Pages only talk to this, never to the data files.
 */
import { BijakServer, MemoryStorage, type KeyValueStore } from './store'

let storage: KeyValueStore | null = null
let instance: BijakServer | null = null

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

export function bijakServer(): BijakServer {
  instance ??= new BijakServer({
    storage: browserStorage(),
    latencyMs: import.meta.env.MODE === 'test' ? 0 : 120,
  })
  return instance
}

/** Test hook: swap in a server (and its device storage). */
export function setBijakServerForTests(server: BijakServer | null, deviceStorage?: KeyValueStore): void {
  instance = server
  storage = deviceStorage ?? null
}

/** Dev / e2e hook: `window.__bijak` lets a spec move the clock for the timer tests. */
export interface BijakWindow {
  __bijak?: { server: BijakServer }
}
