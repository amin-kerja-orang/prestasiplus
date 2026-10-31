import { describe, expect, it } from 'vitest'

import {
  addOption,
  blankDraft,
  blankLeaf,
  draftGaps,
  draftTp,
  hydrate,
  MAX_OPTIONS,
  MIN_OPTIONS,
  removeOption,
  toRequestBody,
  totalMarks,
  withMode,
  type StudioDraft,
} from '../../../lib/studio/draft'

function filled(): StudioDraft {
  const d = blankDraft()
  d.subjectId = '3'
  d.educationLevelId = '7'
  d.stem = 'Rajah 1 menunjukkan litar bersiri.'
  d.unitId = '40'
  d.spIds = ['41', '42']
  d.groupId = '9'
  d.chapterId = '12'
  d.kertas = '1'
  const a = d.leaves[0]!
  a.prompt = 'Pilih jawapan yang betul.'
  a.options.forEach((o, i) => (o.text = `Pilihan ${String(i + 1)}`))
  a.options[1]!.imageToken = 'tokenGambarPilihanB_22'
  a.correct = 'B'
  a.tp = 2
  a.cognitive = 'bukan'
  const b = blankLeaf('b', 'numeric')
  b.prompt = 'Hitung rintangan.'
  b.marks = 2
  b.numeric = { value: '12.5', tolerance: '0.1', unit: 'ohm' }
  b.tp = 4
  b.cognitive = 'menganalisis'
  d.leaves.push(b)
  return d
}

describe('Studio draft', () => {
  it('is incomplete until subject, stem, answers and every DSKP tag are set, and names each gap', () => {
    const gaps = draftGaps(blankDraft()).map((g) => g.message)
    expect(gaps).toContain('Sila pilih subjek.')
    expect(gaps).toContain('Teks soalan mesti sekurang-kurangnya 10 aksara.')
    expect(gaps).toContain('Bahagian (a) mempunyai 0 pilihan betul — mesti tepat 1.')
    expect(gaps).toContain('Bahagian (a) belum ada TP.')
    expect(gaps).toContain('Bahagian (a) belum ada aras pemikiran.')
    expect(gaps).toContain('Soalan belum dipautkan kepada topik DSKP.')
    expect(draftGaps(filled())).toEqual([])
  })

  it('sends the part tree with TP, cognitive level, option pictures, the group, the Bab and the question TP', () => {
    const body = toRequestBody(filled())
    expect(body).toMatchObject({
      subjectId: '3',
      educationLevelId: '7',
      questionType: 'essay',
      questionText: 'Rajah 1 menunjukkan litar bersiri.',
      tag: { unitId: '40', spIds: ['41', '42'], tp: 4 },
      curriculumChapterId: '12',
      kertas: '1',
      stimulusGroupId: '9',
    })
    const parts = body.parts as Array<Record<string, unknown>>
    expect(parts[0]).toMatchObject({
      label: 'a',
      mode: 'mcq',
      marks: 1,
      difficultyTp: 2,
      kbat: 'bukan',
      key: { kind: 'option', correct: 'B' },
    })
    expect((parts[0]!.options as Array<Record<string, unknown>>)[1]).toEqual({ label: 'B', body: { ms: 'Pilihan 2' }, imageId: 'tokenGambarPilihanB_22' })
    expect(parts[1]).toMatchObject({ label: 'b', mode: 'numeric', marks: 2, difficultyTp: 4, kbat: 'menganalisis', key: { kind: 'accepted', values: [{ v: 12.5, tol: 0.1, unit: 'ohm' }] } })
    expect(totalMarks(filled())).toBe(3)
    expect(draftTp(filled())).toBe(4)
  })

  it('does not re-send the group a saved question already belongs to (that would move it to the end)', () => {
    const d = filled()
    expect('stimulusGroupId' in toRequestBody(d, { groupId: '9' })).toBe(false)
    expect(toRequestBody(d, { groupId: null })).toMatchObject({ stimulusGroupId: '9' })
    d.groupId = null
    expect(toRequestBody(d, { groupId: '9' })).toMatchObject({ stimulusGroupId: null })
    expect('stimulusGroupId' in toRequestBody(d)).toBe(false)
  })

  it('reads a saved question back into the same draft', () => {
    const d = filled()
    const body = toRequestBody(d)
    const { draft, unsupported } = hydrate({
      subjectId: '3',
      educationLevelId: '7',
      difficultyLevel: 3,
      questionText: body.questionText as string,
      questionImage: null,
      kertas: '1',
      curriculumChapterId: '12',
      parts: body.parts as unknown[],
      tag: body.tag as { unitId: string; spIds: string[]; tp: number },
      stimulusGroup: { id: '9' },
    })
    expect(unsupported).toEqual([])
    expect(draft.groupId).toBe('9')
    expect(draft.unitId).toBe('40')
    expect(draft.leaves.map((l) => [l.label, l.mode, l.tp, l.cognitive])).toEqual([['a', 'mcq', 2, 'bukan'], ['b', 'numeric', 4, 'menganalisis']])
    expect(draft.leaves[0]!.options[1]).toMatchObject({ text: 'Pilihan 2', imageToken: 'tokenGambarPilihanB_22' })
    expect(draft.leaves[0]!.correct).toBe('B')
    expect(draft.leaves[1]!.numeric).toEqual({ value: '12.5', tolerance: '0.1', unit: 'ohm' })
    expect(draftGaps(draft)).toEqual([])
  })

  it('refuses to edit a question with a mode or a nesting it cannot hold (no silent data loss)', () => {
    const res = hydrate({
      subjectId: '3',
      educationLevelId: '7',
      difficultyLevel: 3,
      questionText: 'Soalan esei yang panjang sekali.',
      questionImage: null,
      curriculumChapterId: null,
      parts: [
        { label: 'a', prompt: { ms: 'Esei' }, mode: 'essay', marks: 10, key: { kind: 'rubric' } },
        { label: 'b', prompt: { ms: 'Bersarang' }, children: [{ label: 'i', prompt: { ms: 'x' }, mode: 'mcq' }] },
      ],
    })
    expect(res.unsupported).toHaveLength(2)
    expect(res.unsupported[0]).toContain('(a)')
    expect(res.unsupported[1]).toContain('(b)')
  })

  it('keeps 3 to 8 options, closes the letters up and keeps the right answer', () => {
    let leaf = blankLeaf('a')
    leaf.correct = 'C'
    expect(leaf.options.map((o) => o.label)).toEqual(['A', 'B', 'C', 'D'])
    leaf = removeOption(leaf, 0)
    expect(leaf.options.map((o) => o.label)).toEqual(['A', 'B', 'C'])
    expect(leaf.correct).toBe('B')
    expect(removeOption(leaf, 0).options).toHaveLength(MIN_OPTIONS)
    expect(removeOption(leaf, 1)).toBe(leaf)
    leaf = addOption(leaf)
    leaf = removeOption(leaf, 1)
    expect(leaf.options.map((o) => o.label)).toEqual(['A', 'B', 'C'])
    expect(leaf.correct).toBe('')
    for (let i = 0; i < 10; i += 1) leaf = addOption(leaf)
    expect(leaf.options).toHaveLength(MAX_OPTIONS)
    expect(withMode(leaf, 'short_text')).toMatchObject({ mode: 'short_text', options: [], correct: '' })
  })
})
