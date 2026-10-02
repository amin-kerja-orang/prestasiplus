/**
 * Programming errors raised by the mock storage primitives. They are bugs in a seed, repository or
 * handler, not API errors: handlers check existence and uniqueness themselves and answer with
 * `fail(...)` (overview §6.4). An uncaught `MockDbError` inside a handler becomes a 500.
 */

export type MockDbErrorCode =
  /** `insert` with an id that already exists. */
  | 'DUPLICATE_ID'
  /** `update` / `remove` of an id that does not exist. */
  | 'NOT_FOUND'
  /** `update` tried to change the primary key. */
  | 'ID_CHANGE'
  /** Two stores registered under one name. */
  | 'DUPLICATE_STORE'
  /** A transaction body returned a promise; bodies must be synchronous. */
  | 'ASYNC_TRANSACTION'
  /** Operation not allowed in the current phase (seed / live) or state. */
  | 'PHASE'
  /** Malformed query, id or strategy input. */
  | 'INVALID'
  /** An id strategy could not produce an id. */
  | 'ID_EXHAUSTED'
  /** A commit listener (F-07 persistence) failed; `seq` names the commit, `cause` the error. */
  | 'COMMIT_FAILED'

export class MockDbError extends Error {
  readonly code: MockDbErrorCode
  /** `COMMIT_FAILED` only: the seq of the commit whose listener failed. */
  readonly seq?: number

  constructor(
    code: MockDbErrorCode,
    message: string,
    extra: { seq?: number; cause?: unknown } = {},
  ) {
    super(message, extra.cause === undefined ? undefined : { cause: extra.cause })
    this.name = 'MockDbError'
    this.code = code
    if (extra.seq !== undefined) this.seq = extra.seq
  }
}
