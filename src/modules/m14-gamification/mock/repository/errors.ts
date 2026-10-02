/** M14 refusal codes (SRS M14 v1.7 §7; BR-M14-10/20/22/26/27/29/30). */
export type M14ErrorCode =
  | 'INSUFFICIENT_BALANCE'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'DRAW_CLOSED'
  | 'TICKET_LIMIT'
  | 'CASH_DISABLED'
  | 'OUT_OF_STOCK'
  | 'LIMIT_REACHED'

/** A refused M14 write (nothing is written). Handlers map `code` to the §7 error responses. */
export class M14Error extends Error {
  readonly code: M14ErrorCode
  constructor(code: M14ErrorCode, message: string) {
    super(message)
    this.name = 'M14Error'
    this.code = code
  }
}
