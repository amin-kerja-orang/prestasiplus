/**
 * Errors raised while building a virtual dataset (overview §6.6, ADR-0013).
 *
 * A `DatasetSpecError` means the dataset spec itself cannot be met: cells do not add up to the
 * total, an anchor has no cell or overflows its cell, `fit2d` marginals are infeasible, etc. It is a
 * requirements contradiction that D9/D11 route back to the owner SRS, so it fails the build (unit
 * test) and the boot (compile). Store-operation errors (unknown id, duplicate id, phase) reuse
 * `MockDbError` so that repositories handle tables and datasets alike.
 */

export type DatasetIssueCode =
  /** A cell count is not a non-negative integer, or a cell's facets do not match `facets`. */
  | 'CELL'
  /** Σ cell counts differs from the declared total. */
  | 'TOTAL'
  /** `idRange` / reserved ranges / runtime floor are malformed, overlap, or cannot hold the slots. */
  | 'RANGE'
  /** An anchor id is invalid, duplicated, or outside `idRange` and every reserved range. */
  | 'ANCHOR_ID'
  /** An anchor's facet combination is not a cell of the spec. */
  | 'ANCHOR_NO_CELL'
  /** A cell has more anchors than its count ("fixtures are anchors, not additions"). */
  | 'ANCHOR_OVERFLOW'
  /** A layout block cannot be placed. */
  | 'LAYOUT'
  /** `fit2d` / `nest` / `split` input cannot be met exactly. */
  | 'INFEASIBLE'
  /** A named query's computed value differs from its documented expected value. */
  | 'NAMED_QUERY'

export interface DatasetIssue {
  code: DatasetIssueCode
  message: string
}

export class DatasetSpecError extends Error {
  readonly issues: readonly DatasetIssue[]

  constructor(context: string, issues: readonly DatasetIssue[]) {
    const head = issues
      .slice(0, 10)
      .map((i) => `  [${i.code}] ${i.message}`)
      .join('\n')
    const more = issues.length > 10 ? `\n  … and ${String(issues.length - 10)} more` : ''
    super(`${context}: ${String(issues.length)} spec issue(s)\n${head}${more}`)
    this.name = 'DatasetSpecError'
    this.issues = issues
  }
}
