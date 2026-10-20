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
