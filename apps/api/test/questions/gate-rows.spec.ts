import { INTAKE_GATE_MESSAGES, type QuestionPart } from '@pp/contract'
import { describe, expect, it } from 'vitest'

import { dskpApprovalIssues } from '../../src/modules/questions/dskp-gate'
import { TRANSITION_CONFLICT_MESSAGE } from '../../src/modules/questions/errors'
import { checkDifficultyGate, checkStemGate, checkTagGate, type TagGateInput } from '../../src/modules/questions/publish-gate'
import { gateIssuesOf } from '../../src/modules/questions/workflow/lifecycle/gate-issues'

/** S1-T02, 45 section 4.1: the rows that need no group, flag or validator data, table-driven (code, path, exact message, step). */
const tagged: TagGateInput = { subjectId: '1', educationLevelId: '2', unitId: '3', spIds: ['4'], tp: 3, hasDskpNodes: true, hasChapters: true, chapterId: '5' }
const mcq = (marks = 1): QuestionPart => ({ label: '', mode: 'mcq', marks, options: [], key: { kind: 'option', correct: 'A' } }) as unknown as QuestionPart
const working = (label: string, extra: Record<string, unknown> = {}): QuestionPart => ({ label, mode: 'working', marks: 2, ...extra }) as unknown as QuestionPart

describe('tag gate rows 1 to 8 (R-DSKP and NO_CHAPTER)', () => {
  const cases: { name: string; input: Partial<TagGateInput>; fields: Record<string, string>; code: string; step: number }[] = [
    { name: '1 NO_SUBJECT', input: { subjectId: null }, fields: { subjectId: 'Sila pilih subjek.' }, code: 'NO_SUBJECT', step: 4 },
    { name: '2 NO_LEVEL', input: { educationLevelId: null }, fields: { educationLevelId: 'Sila pilih tahap pendidikan.' }, code: 'NO_LEVEL', step: 4 },
    { name: '3 NO_UNIT', input: { unitId: null }, fields: { unitId: 'Sila pilih unit DSKP.' }, code: 'NO_UNIT', step: 4 },
    { name: '4 NO_SP (none)', input: { spIds: [] }, fields: { spIds: 'Sila pilih sekurang-kurangnya satu SP DSKP.' }, code: 'NO_SP', step: 4 },
    { name: '4 NO_SP (more than 3)', input: { spIds: ['1', '2', '3', '4'] }, fields: { spIds: 'Sila pilih sekurang-kurangnya satu SP DSKP.' }, code: 'NO_SP', step: 4 },
    { name: 'TP_MISSING (kept)', input: { tp: null }, fields: { tp: 'Sila pilih tahap penguasaan (TP).' }, code: 'TP_MISSING', step: 4 },
    { name: '8 NO_CHAPTER', input: { chapterId: null }, fields: { chapterId: 'Sila pilih Bab.' }, code: 'NO_CHAPTER', step: 4 },
    { name: 'SP outside the unit (FR-ADM-QE4.3, gate-check repeats it)', input: { spOutsideUnit: ['1.1'] }, fields: { spIds: INTAKE_GATE_MESSAGES.spNotInTaxonomy('1.1') }, code: 'SP_NOT_IN_TAXONOMY', step: 4 },
  ]
  it.each(cases)('$name', ({ input, fields, code, step }) => {
    const out = checkTagGate({ ...tagged, ...input })
    expect(out).toEqual(fields)
    expect(gateIssuesOf(out)).toEqual(Object.entries(fields).map(([path, message]) => ({ path, message, code, step })))
  })

  it('a complete tag passes', () => {
    expect(checkTagGate(tagged)).toEqual({})
  })

  it('without DSKP nodes the unit, SP and TP items are skipped, subject and level stay required', () => {
    const none = { subjectId: null, educationLevelId: null, unitId: null, spIds: [], tp: null, hasDskpNodes: false, hasChapters: false }
    expect(checkTagGate(none)).toEqual({ subjectId: 'Sila pilih subjek.', educationLevelId: 'Sila pilih tahap pendidikan.' })
    expect(checkTagGate({ ...none, subjectId: '1', educationLevelId: '1' })).toEqual({})
  })

  it('the Bab is asked only where chapters exist (no chapters: no item, even with no chapterId)', () => {
    expect(checkTagGate({ ...tagged, hasChapters: false, chapterId: null })).toEqual({})
    expect(checkTagGate({ ...tagged, hasChapters: true, chapterId: null })).toEqual({ chapterId: 'Sila pilih Bab.' })
  })
})

describe('row 9 NO_DIFFICULTY (refused only when the typed Kesukaran and the TP are both null)', () => {
  it.each([
    { difficultyLevel: null, tp: null, refused: true },
    { difficultyLevel: undefined, tp: null, refused: true },
    { difficultyLevel: null, tp: 3, refused: false },
    { difficultyLevel: 2, tp: null, refused: false },
    { difficultyLevel: 5, tp: 6, refused: false },
  ])('level $difficultyLevel, tp $tp', ({ difficultyLevel, tp, refused }) => {
    const out = checkDifficultyGate({ difficultyLevel, tp })
    expect(out).toEqual(refused ? { difficultyLevel: 'Sila pilih tahap kesukaran.' } : {})
    if (refused) expect(gateIssuesOf(out)).toEqual([{ path: 'difficultyLevel', message: 'Sila pilih tahap kesukaran.', code: 'NO_DIFFICULTY', step: 4 }])
  })
})

describe('row 10 STEM_SHORT (the stem of an MCQ)', () => {
  it('9 characters is refused, 10 passes, spaces do not count, a blank stem is the required-field item instead', () => {
    expect(checkStemGate('Apakah ini', [mcq()])).toEqual({})
    expect(checkStemGate('Apakah in', [mcq()])).toEqual({ questionText: 'Teks soalan mesti sekurang-kurangnya 10 aksara.' })
    expect(checkStemGate('   Apakah in   ', [mcq()])).toEqual({ questionText: 'Teks soalan mesti sekurang-kurangnya 10 aksara.' })
    expect(checkStemGate('', [mcq()])).toEqual({})
    expect(checkStemGate(null, [mcq()])).toEqual({})
  })
  it('names the question text on step 1 with the code STEM_SHORT; a structured stem is not checked', () => {
    const out = checkStemGate('Pendek', [mcq()])
    expect(gateIssuesOf(out)).toEqual([{ path: 'questionText', message: 'Teks soalan mesti sekurang-kurangnya 10 aksara.', code: 'STEM_SHORT', step: 1 }])
    expect(checkStemGate('Pendek', [working('a')])).toEqual({})
    expect(checkStemGate('Pendek', [mcq(), mcq()])).toEqual({})
  })
})

describe('rows 5 to 7 (leaf TP, leaf aras, kertas)', () => {
  const base = { parts: [working('b')], tp: null, unitId: '1', spIds: ['1'], paperCode: null }
  it('leaf aras and leaf TP bind where DSKP nodes exist, whatever the subject; the kertas only where SPM-bound', () => {
    const issues = dskpApprovalIssues({ ...base, spmBound: false, hasDskpNodes: true })
    expect(issues).toEqual([
      { path: 'parts.b.cognitiveLevel', code: 'LEAF_NO_ARAS', message: 'Bahagian (b) belum ada aras pemikiran.', step: 3 },
      { path: 'parts.b.difficultyTp', code: 'LEAF_NO_TP', message: 'Bahagian (b) belum ada TP.', step: 3 },
    ])
    expect(gateIssuesOf(Object.fromEntries(issues.map((i) => [i.path, i.message]))).map((i) => i.code)).toEqual(['LEAF_NO_ARAS', 'LEAF_NO_TP'])
    const spm = dskpApprovalIssues({ ...base, spmBound: true, hasDskpNodes: true })
    expect(spm.at(-1)).toEqual({ path: 'kertas', code: 'NO_KERTAS', message: 'Sila pilih kertas untuk soalan SPM.', step: 1 })
  })
  it('without DSKP nodes there is no leaf item; an SPM-bound question still needs its kertas', () => {
    expect(dskpApprovalIssues({ ...base, spmBound: false, hasDskpNodes: false })).toEqual([])
    expect(dskpApprovalIssues({ ...base, spmBound: true, hasDskpNodes: false }).map((i) => i.code)).toEqual(['NO_KERTAS'])
  })
})

describe('row 30 / ERR-CON-04', () => {
  it('one catalogue text for every status pair', () => {
    expect(TRANSITION_CONFLICT_MESSAGE('draft', 'approved')).toBe('Perubahan status ini tidak dibenarkan daripada status semasa.')
    expect(TRANSITION_CONFLICT_MESSAGE('approved', 'approved')).toBe('Perubahan status ini tidak dibenarkan daripada status semasa.')
  })
})
