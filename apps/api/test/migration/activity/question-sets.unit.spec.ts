/**
 * BE-29 question-set header transform (OD-10 Q4 A), pure, no database. Synthetic values only.
 */
import { describe, expect, it } from 'vitest'

import { MIGRATED_SET_STATUS, transformQuestionSet, type QuestionSetParents } from '../../../src/migration/transform/question-sets'

const parents: QuestionSetParents = { teacherId: '501', teacherIsTeacher: true, subjectId: '9' }
const row = { id: '1', teacher_id: '7', title: 'Set Contoh', subject_id: '3', education_level_id: '1', status: 'terbit' }

describe('transformQuestionSet', () => {
  it('gives a header with no class, needs_rebuild, a draft status whatever the source status, and the mapped owner', () => {
    expect(transformQuestionSet(row, parents)).toEqual({
      ok: true,
      value: {
        teacher_id: '501', classroom_id: null, subject_id: '9', title: 'Set Contoh', status: 'draft', needs_rebuild: true,
        created_at: '1970-01-01T00:00:00Z', updated_at: '1970-01-01T00:00:00Z',
      },
    })
    expect(MIGRATED_SET_STATUS).toBe('draft')
    for (const status of ['draf', 'terbit', 'published', null, 'tidak_dikenali']) {
      const out = transformQuestionSet({ ...row, status }, parents)
      expect(out.ok && out.value.status).toBe('draft')
    }
  })

  it('keeps the staged source timestamps, updated falling back to created', () => {
    expect(transformQuestionSet({ ...row, created_at: '2025-03-04T05:06:07Z', updated_at: '2025-05-06T07:08:09Z' }, parents)).toMatchObject({
      ok: true, value: { created_at: '2025-03-04T05:06:07Z', updated_at: '2025-05-06T07:08:09Z' },
    })
    expect(transformQuestionSet({ ...row, created_at: '2025-03-04T05:06:07Z' }, parents)).toMatchObject({
      ok: true, value: { created_at: '2025-03-04T05:06:07Z', updated_at: '2025-03-04T05:06:07Z' },
    })
  })

  it('trims the title and keeps a subject-less set with a null subject', () => {
    const out = transformQuestionSet({ ...row, title: '  Set   Dua  ', subject_id: null }, { ...parents, subjectId: undefined })
    expect(out).toMatchObject({ ok: true, value: { title: 'Set   Dua', subject_id: null } })
  })

  it('rejects a blank teacher INVALID_VALUE, an unmapped one ORPHAN_PARENT and a non-teacher UNSUPPORTED (never an invented owner)', () => {
    expect(transformQuestionSet({ ...row, teacher_id: null }, { ...parents, teacherId: undefined })).toEqual({ ok: false, reject: { reason: 'INVALID_VALUE', column: 'teacher_id' } })
    expect(transformQuestionSet(row, { ...parents, teacherId: undefined })).toEqual({ ok: false, reject: { reason: 'ORPHAN_PARENT', column: 'teacher_id' } })
    expect(transformQuestionSet(row, { ...parents, teacherIsTeacher: false })).toEqual({ ok: false, reject: { reason: 'UNSUPPORTED', column: 'teacher_id' } })
  })

  it('rejects a blank or over-long title and a staged subject that is not mapped', () => {
    expect(transformQuestionSet({ ...row, title: '   ' }, parents)).toEqual({ ok: false, reject: { reason: 'INVALID_VALUE', column: 'title' } })
    expect(transformQuestionSet({ ...row, title: 'x'.repeat(256) }, parents)).toEqual({ ok: false, reject: { reason: 'INVALID_VALUE', column: 'title' } })
    expect(transformQuestionSet({ ...row, title: 'x'.repeat(255) }, parents).ok).toBe(true)
    expect(transformQuestionSet(row, { ...parents, subjectId: undefined })).toEqual({ ok: false, reject: { reason: 'ORPHAN_PARENT', column: 'subject_id' } })
  })
})
