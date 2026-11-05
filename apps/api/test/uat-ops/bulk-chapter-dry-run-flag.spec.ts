import { describe, expect, it } from 'vitest'

import { NOT_FLAGGED_TEXT } from '../../scripts/uat-ops/bulk-chapter-dry-run'
import { NOT_FLAGGED_SQL } from '../../src/modules/questions/learner-visibility'

/** The dry-run script inlines the not-flagged predicate (it has no Prisma client); it must stay the exported one that API-DSKP-10 uses. */
describe('bulk-chapter-dry-run not-flagged predicate', () => {
  it('equals NOT_FLAGGED_SQL (the fragment chapter-coverage uses)', () => {
    expect(NOT_FLAGGED_SQL.values).toEqual([])
    expect(NOT_FLAGGED_TEXT).toBe(NOT_FLAGGED_SQL.sql)
  })
})
