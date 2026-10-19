/**
 * Build-time / boot-time feasibility checks (overview §6.6 step 4, ADR-0013 §2 and §4).
 *
 * `assertFeasible(dataset, namedQueries?)` is what each owner's dataset unit test calls: it fails
 * when the cells do not sum to the total, an anchor has no cell or overflows its cell, an id range
 * or the runtime floor is wrong, a layout block does not fit, the distribution helpers (`fit2d`,
 * `nest`, `split`) cannot be met, or a named query differs from its documented value. Display
 * constants are not part of any dataset and are never checked here (XL-34).
 */

import { DatasetSpecError, type DatasetIssue } from './errors'
import { checkNamedQueries } from './named-queries'
import type { FeasibilityReport } from './types'

/** Anything with a feasibility report (every `VirtualDataset`). */
export interface FeasibilitySubject {
  readonly name: string
  feasibility(): FeasibilityReport
}

export function checkFeasibility(
  dataset: FeasibilitySubject,
  namedQueries?: object,
): FeasibilityReport {
  const report = dataset.feasibility()
  if (report.ok && namedQueries) {
    const issues: DatasetIssue[] = checkNamedQueries(namedQueries)
    if (issues.length > 0) return { ...report, ok: false, issues: [...report.issues, ...issues] }
  }
  return report
}

export function assertFeasible(
  dataset: FeasibilitySubject,
  namedQueries?: object,
): FeasibilityReport {
  const report = checkFeasibility(dataset, namedQueries)
  if (!report.ok) throw new DatasetSpecError(`virtual dataset '${dataset.name}'`, report.issues)
  return report
}
