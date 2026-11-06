import { describe, expect, it } from 'vitest'

import { Prisma } from '../../src/db/generated/client'
import { MEDIA_RESOLVED_SQL, SPM_SERVABLE_SQL, VERSION_STIMULI_SQL, mediaResolvedSql } from '../../src/modules/questions/learner-visibility'

/** S1-T06 (FR-X1-4f): the pupil-serving media rule is the approve-gate rule, written once (no DB needed). */
describe('MEDIA_RESOLVED_SQL (S1-T06, FR-X1-4f)', () => {
  it('checks the file of every picture kind, the table grid, passage text and the legacy_image_unresolved hold', () => {
    const text = MEDIA_RESOLVED_SQL.sql
    expect(text).toContain(`s.kind IN ('image', 'diagram', 'map', 'infographic', 'graph') AND s.asset_file_id IS NULL`)
    expect(text).toContain(`s.kind = 'table'`)
    expect(text).toContain(`s.kind = 'passage'`)
    expect(text).toContain('legacy_image_unresolved')
    expect(text).toContain('v.import_issues')
  })

  it('looks at the question\'s own, part and GROUP stimuli, so one missing group file drops every member (complete-group rule)', () => {
    expect(VERSION_STIMULI_SQL.sql).toContain('question_version_stimuli')
    expect(VERSION_STIMULI_SQL.sql).toContain('question_parts')
    expect(VERSION_STIMULI_SQL.sql).toContain('stimulus_group_stimuli gs WHERE gs.group_id = q.group_id')
  })

  it('is built by the same function the approve gate uses (one definition) and is part of SPM_SERVABLE_SQL', () => {
    expect(mediaResolvedSql(VERSION_STIMULI_SQL, Prisma.sql`v.import_issues`).sql).toBe(MEDIA_RESOLVED_SQL.sql)
    expect(SPM_SERVABLE_SQL.sql).toContain(MEDIA_RESOLVED_SQL.sql)
  })
})
