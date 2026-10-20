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
import { createHttpBijakAdminServer, type BijakAdminMethods } from './http-admin'
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

/**
 * Admin (staff) server: in http mode the admin HTTP client (`./http-admin`: paper builder and
 * blueprints; methods without a backend route reject with `BijakError('unavailable')`), which also
 * carries the student surface. Otherwise the in-browser mock. Never throws at page setup.
 */
export type BijakAdminApi = BijakApi & BijakAdminMethods

let adminInstance: BijakAdminApi | null = null

export function bijakAdminServer(): BijakAdminApi {
  if (instance && 'listAdminPapers' in instance) return instance as BijakAdminApi
  if (createMock === null) {
    adminInstance ??= createHttpBijakAdminServer()
    return adminInstance
  }
  return bijakServer() as BijakServer
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
