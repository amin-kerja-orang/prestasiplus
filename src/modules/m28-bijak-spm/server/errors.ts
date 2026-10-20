/** The error both Bijak server implementations (mock and HTTP) throw; pages read `code`. */
export type BijakErrorCode = 'not_found' | 'forbidden' | 'not_submitted' | 'offline' | 'bad_request' | 'unavailable'

export class BijakError extends Error {
  constructor(
    readonly code: BijakErrorCode,
    message: string,
  ) {
    super(message)
  }
}

/** The screen has no backend route yet (http mode): pages show a friendly demo state, not a load error. */
export const UNAVAILABLE_TITLE = 'Fungsi ini belum tersedia dalam demo'
export function isUnavailable(err: unknown): boolean {
  return err instanceof BijakError && err.code === 'unavailable'
}
