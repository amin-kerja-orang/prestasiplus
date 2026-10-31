/**
 * The handle to the Set Builder admin API. `VITE_API_MODE=http` talks to the real
 * `/api/admin/papers*` routes; otherwise one in-browser mock per tab. Same env-check pattern as
 * `../../kontrak/server/client`: the mock is behind a top-level dynamic import with a literal env
 * check, so the http build drops it.
 */
import type { BuilderApi } from './api'
import { createHttpBuilderServer } from './http'

const createMock =
  import.meta.env.VITE_API_MODE === 'http' ? null : (await import('./local-builder')).createMockBuilderServer

let instance: BuilderApi | null = null

export function builderServer(): BuilderApi {
  instance ??= createMock ? createMock() : createHttpBuilderServer()
  return instance
}

/** Test hook. */
export function setBuilderServerForTests(server: BuilderApi | null): void {
  instance = server
}
