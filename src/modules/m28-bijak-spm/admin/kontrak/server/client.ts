/**
 * The handle to the Kontrak Blueprint admin API. `VITE_API_MODE=http` talks to the real
 * `/api/admin/blueprints*` routes; otherwise one in-browser mock per tab. Same env-check pattern as
 * `../../../server/client`: the mock (and its seed registry) is loaded by a top-level dynamic import
 * behind a literal env check, so the http build drops it.
 */
import type { KontrakApi } from './api'
import { createHttpKontrakServer } from './http'

const createMock =
  import.meta.env.VITE_API_MODE === 'http' ? null : (await import('./local-kontrak')).createMockKontrakServer

let instance: KontrakApi | null = null

export function kontrakServer(): KontrakApi {
  instance ??= createMock ? createMock() : createHttpKontrakServer()
  return instance
}

/** Test hook. */
export function setKontrakServerForTests(server: KontrakApi | null): void {
  instance = server
}
