/** Handle to the Kandungan SPM reads: the http client in `VITE_API_MODE=http`, else one in-browser mock per tab (same pattern as the Kontrak client). */
import type { KandunganApi } from './api'
import { HttpKandunganServer } from './http'

const createMock =
  import.meta.env.VITE_API_MODE === 'http' ? null : (await import('./mock')).createMockKandungan

let instance: KandunganApi | null = null

export function kandunganServer(): KandunganApi {
  instance ??= createMock ? createMock() : new HttpKandunganServer()
  return instance
}

/** Test hook. */
export function setKandunganServerForTests(server: KandunganApi | null): void {
  instance = server
}
