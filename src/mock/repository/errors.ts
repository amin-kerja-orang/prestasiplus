/**
 * Errors raised by the repository framework (D12, ADR-0014). Like `MockDbError`, they are
 * programming errors in a seed, repository or handler, not API errors: an uncaught one inside a
 * handler becomes a 500, and at boot it stops the mock from starting.
 */

export type RepositoryErrorCode =
  /** A write to a shared store from outside its owner's repository (D12). */
  | 'OWNERSHIP'
  /** A call in the wrong lifecycle phase (contribute after finalise, read before finalise). */
  | 'PHASE'
  /** Two repositories with one name (boot error). */
  | 'DUPLICATE_REPOSITORY'
  /** A plugin breaks the `repositories` export convention (owner, provisional, stores). */
  | 'CONVENTION'
  /** Invalid definition or contract input (method name clash, invalid contribution rows). */
  | 'CONTRACT'

export class RepositoryError extends Error {
  readonly code: RepositoryErrorCode
  /** Individual problems (e.g. every rejected anchor), when there are several. */
  readonly issues: readonly string[]

  constructor(code: RepositoryErrorCode, message: string, issues: readonly string[] = []) {
    super(issues.length > 0 ? `${message}\n- ${issues.join('\n- ')}` : message)
    this.name = 'RepositoryError'
    this.code = code
    this.issues = issues
  }
}
