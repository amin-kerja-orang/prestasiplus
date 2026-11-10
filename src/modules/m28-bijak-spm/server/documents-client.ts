/**
 * The handle to the Kertas Subjektif document API. `VITE_API_MODE=http` talks to the real routes; otherwise one in-browser mock per tab.
 * Same env-check pattern as `./client`: the mock is behind a top-level dynamic import with a literal env check, so the http build drops it.
 */
import { createHttpKertasDokumenApi } from './documents-http'
import type { KertasDokumenApi } from './documents-types'

const createMock = import.meta.env.VITE_API_MODE === 'http' ? null : (await import('./documents-mock')).createMockKertasDokumenApi

let instance: KertasDokumenApi | null = null

export function kertasDokumenServer(): KertasDokumenApi {
  instance ??= createMock ? createMock() : createHttpKertasDokumenApi()
  return instance
}

/** Test hook. */
export function setKertasDokumenServerForTests(server: KertasDokumenApi | null): void {
  instance = server
}
