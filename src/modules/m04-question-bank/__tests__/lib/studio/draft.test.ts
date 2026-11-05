import { describe, expect, it } from 'vitest'

import {
  addOption,
  blankDraft,
  blankLeaf,
  draftGaps,
  draftTp,
  draftTpNote,
  editAsDraftBody,
  hydrate,
  MAX_OPTIONS,
  MIN_OPTIONS,
  removeOption,
  toRequestBody,
  totalMarks,
  withMode,
  type StudioDraft,
  completenessRows,
  issueField,
} from '../../../lib/studio/draft'

function filled(): StudioDraft {
  const d = blankDraft()
  d.subjectId = '3'
  d.educationLevelId = '7'
  d.numberLabel = '1'
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
  a.cognitive = 'memahami'
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
    expect(gaps).toContain('Sila isi nombor soalan.')
    expect(gaps).toContain('Sila pilih unit DSKP.')
    expect(draftGaps(filled())).toEqual([])
  })

  it('asks for a kertas on an SPM level (Tingkatan 4 or 5) and not on others', () => {
    const d = filled()
    d.kertas = ''
    expect(draftGaps(d, 'Tingkatan 4').map((g) => g.message)).toEqual(['Sila pilih kertas untuk soalan SPM.'])
    expect(draftGaps(d, 'Tingkatan 2')).toEqual([])
  })

  it('reads the six-level cognitive field, then the old kbat, and leaves kbat bukan unset', () => {
    const leaf = (extra: Record<string, unknown>) =>
      hydrate({ subjectId: '1', educationLevelId: '1', difficultyLevel: 3, questionText: 'Soalan yang cukup panjang.', questionImage: null, curriculumChapterId: null,
        parts: [{ label: 'a', prompt: { ms: 'x' }, mode: 'short_text', marks: 1, key: { kind: 'accepted', values: ['y'] }, ...extra }] }).draft.leaves[0]!.cognitive
    expect(leaf({ cognitiveLevel: 'mengingat', kbat: 'bukan' })).toBe('mengingat')
    expect(leaf({ kbat: 'menilai' })).toBe('menilai')
    expect(leaf({ kbat: 'bukan' })).toBeNull()
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
      numberLabel: '1',
    })
    expect('stimulusGroupId' in body).toBe(false)
    const parts = body.parts as Array<Record<string, unknown>>
    expect(parts[0]).toMatchObject({
      label: 'a',
      mode: 'mcq',
      marks: 1,
      difficultyTp: 2,
      cognitiveLevel: 'memahami',
      kbat: 'bukan',
      key: { kind: 'option', correct: 'B' },
    })
    expect((parts[0]!.options as Array<Record<string, unknown>>)[1]).toEqual({ label: 'B', body: { ms: 'Pilihan 2' }, imageId: 'tokenGambarPilihanB_22' })
    expect(parts[1]).toMatchObject({ label: 'b', mode: 'numeric', marks: 2, difficultyTp: 4, cognitiveLevel: 'menganalisis', kbat: 'menganalisis', key: { kind: 'accepted', values: [{ v: 12.5, tol: 0.1, unit: 'ohm' }] } })
    expect(totalMarks(filled())).toBe(3)
    expect(draftTp(filled())).toBe(4)
  })

  it('never sends the group: membership changes through the group API, not through the question save', () => {
    const d = filled()
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
      numberLabel: '1',
      parts: body.parts as unknown[],
      tag: body.tag as { unitId: string; spIds: string[]; tp: number },
      stimulusGroup: { id: '9' },
    })
    expect(unsupported).toEqual([])
    expect(draft.groupId).toBe('9')
    expect(draft.numberLabel).toBe('1')
    expect(draft.unitId).toBe('40')
    expect(draft.leaves.map((l) => [l.label, l.mode, l.tp, l.cognitive])).toEqual([['a', 'mcq', 2, 'memahami'], ['b', 'numeric', 4, 'menganalisis']])
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

  describe('lossless guard (T13b)', () => {
    const wire = (part: Record<string, unknown>, tag: { unitId: string | null; spIds: string[]; tp: number | null } = { unitId: null, spIds: [], tp: null }) => ({
      subjectId: '3',
      educationLevelId: '7',
      difficultyLevel: 3,
      questionText: 'Soalan yang cukup panjang.',
      questionImage: null,
      curriculumChapterId: null,
      parts: [{ label: 'a', prompt: { ms: 'P' }, marks: 1, ...part }],
      tag,
    })
    const shortText = { mode: 'short_text', key: { kind: 'accepted', values: ['ya'] } }
    const numeric = { mode: 'numeric', key: { kind: 'accepted', values: [{ v: 2 }] } }

    it.each([
      ['reveal', { ...shortText, reveal: 'never' }],
      ['leaf stimulusId', { ...shortText, stimulusId: '5' }],
      ['caseSensitive', { mode: 'short_text', key: { kind: 'accepted', values: ['ya'], caseSensitive: true } }],
      ['anyOrder', { mode: 'short_text', key: { kind: 'accepted', values: ['ya'], anyOrder: true } }],
      ['numeric tolKind rel', { mode: 'numeric', key: { kind: 'accepted', values: [{ v: 2, tol: 1, tolKind: 'rel' }] } }],
      ['numeric sigFigs', { mode: 'numeric', key: { kind: 'accepted', values: [{ v: 2, sigFigs: 3 }] } }],
      ['second numeric value', { mode: 'numeric', key: { kind: 'accepted', values: [{ v: 2 }, { v: 3 }] } }],
      ['kbat contradicting the level', { ...shortText, cognitiveLevel: 'mengingat', kbat: 'menilai' }],
      ['prompt.en', { ...shortText, prompt: { ms: 'P', en: 'Q' } }],
    ])('marks %s as unsupported instead of dropping it', (_n, part) => {
      expect(hydrate(wire(part)).unsupported).toHaveLength(1)
    })

    it('marks a stored question TP that differs from the part TPs as unsupported', () => {
      expect(hydrate(wire({ ...numeric, difficultyTp: 2 }, { unitId: null, spIds: [], tp: 3 })).unsupported).toHaveLength(1)
      expect(hydrate(wire({ ...numeric, difficultyTp: 3 }, { unitId: null, spIds: [], tp: 3 })).unsupported).toEqual([])
    })

    it('lets a single part without a TP inherit the stored question TP (intake-born, REQ-B-038)', () => {
      const h = hydrate(wire(numeric, { unitId: null, spIds: [], tp: 3 }))
      expect(h.unsupported).toEqual([])
      expect(h.draft.leaves[0]?.tp).toBeNull()
      expect(draftTp(h.draft)).toBe(3)
      expect((toRequestBody(h.draft).tag as { tp: number | null }).tp).toBe(3)
      // once the author sets a part TP, the highest part TP wins
      const edited = { ...h.draft, leaves: h.draft.leaves.map((l) => ({ ...l, tp: 5 })) }
      expect(draftTp(edited)).toBe(5)
    })

    it('does not report an inherited part as missing its TP, and keeps the inherited TP when a lower TP part is added (REQ-B-038 minors)', () => {
      const h = hydrate(wire(numeric, { unitId: null, spIds: [], tp: 3 }))
      expect(draftGaps(h.draft).map((g) => g.message)).not.toContain('Bahagian (a) belum ada TP.')
      const b = { ...blankLeaf('b'), tp: 2 }
      const withB = { ...h.draft, leaves: [...h.draft.leaves, b] }
      expect(draftTp(withB)).toBe(3)
      expect(draftGaps(withB).map((g) => g.message)).not.toContain('Bahagian (a) belum ada TP.')
      expect(draftGaps(withB).map((g) => g.message)).toContain('Bahagian (b) belum ada aras pemikiran.')
    })

    it('words the TP note by where the TP comes from', () => {
      const h = hydrate(wire(numeric, { unitId: null, spIds: [], tp: 3 }))
      expect(draftTpNote(h.draft)).toBe('(diwarisi daripada soalan)')
      const mixed = { ...h.draft, leaves: [...h.draft.leaves, { ...blankLeaf('b'), tp: 2 }] }
      expect(draftTp(mixed)).toBe(3)
      expect(draftTpNote(mixed)).toBe('(diwarisi daripada soalan)')
      const own = { ...h.draft, leaves: [...h.draft.leaves, { ...blankLeaf('b'), tp: 5 }] }
      expect(draftTpNote(own)).toBe('(tertinggi antara bahagian)')
    })

    it('does not invent a TP for a question that has none', () => {
      const h = hydrate(wire(numeric))
      expect(h.unsupported).toEqual([])
      expect(draftTp(h.draft)).toBeNull()
    })

    it('accepts null-valued extras and explicit defaults', () => {
      expect(hydrate(wire({ ...shortText, reveal: null, stimulusId: undefined, key: { kind: 'accepted', values: ['ya'], caseSensitive: false } })).unsupported).toEqual([])
    })

    it('edit-as-draft sends the four required fields and the stored parts only', () => {
      const q = { ...wire({ ...shortText, reveal: 'never' }, { unitId: '9', spIds: ['1'], tp: 4 }), numberLabel: '7', kertas: '2' }
      const body = editAsDraftBody(q)
      expect(Object.keys(body).sort()).toEqual(['difficultyLevel', 'educationLevelId', 'parts', 'questionText', 'subjectId'])
      expect(body.parts).toBe(q.parts)
    })
  })

  describe('completenessRows (AC-ADM-QE4.1, AC-ADM-QE4.5)', () => {
    const full = (): StudioDraft => {
      const d = blankDraft()
      d.subjectId = '3'
      d.educationLevelId = '7'
      d.numberLabel = '1'
      d.kertas = '1'
      d.stem = 'Soalan yang cukup panjang.'
      const leaf = d.leaves[0]!
      leaf.prompt = 'Pilih.'
      leaf.options = leaf.options.map((o) => ({ ...o, text: 'x' }))
      leaf.correct = 'A'
      leaf.tp = 2
      leaf.cognitive = 'memahami'
      return d
    }
    const tagged = (): StudioDraft => ({ ...full(), unitId: '40', spIds: ['41'] })
    const rows = (draft: StudioDraft, issues: { path: string; message: string }[] | null, hasDskp: boolean | null = true, stored: StudioDraft | null = null, chapters?: boolean) =>
      completenessRows({ draft, gaps: draftGaps(draft, '', { hasChapters: chapters ?? null }), issues, stored, hasDskp }).map((r) => r.message)
    const UNIT = { path: 'unitId', message: 'Sila pilih unit DSKP.' }
    const SP = { path: 'spIds', message: 'Sila pilih sekurang-kurangnya satu SP DSKP.' }

    it('a draft missing unit and SP lists the two, once each, with a count of 2', () => {
      const d = full()
      expect(rows(d, [UNIT, SP], true, d)).toEqual([UNIT.message, SP.message])
      expect(rows(d, null)).toEqual([UNIT.message, SP.message])
    })

    it('a Subjek with no DSKP nodes never lists SP or TP, saved or not (AC-ADM-QE4.5)', () => {
      const d = full()
      d.leaves[0]!.tp = null
      d.leaves[0]!.cognitive = null
      expect(rows(d, null, false)).toEqual([])
      expect(rows(d, [], false, d)).toEqual([])
    })

    it('while the nodes are not known, the gate decides once it has answered', () => {
      expect(rows(full(), [], null, full())).toEqual([])
      expect(rows(full(), null, null)).toEqual([UNIT.message, SP.message])
    })

    it('clearing the DSKP fields on a saved question lists them before the next save', () => {
      const stored = tagged()
      expect(rows(full(), [], true, stored)).toEqual([UNIT.message, SP.message])
    })

    it('an issue on a field that has a value but did not change stays: the gate may refuse it for another reason', () => {
      const d = tagged()
      const outside = { path: 'spIds', message: 'SP "99.9" tiada dalam senarai kurikulum.' }
      expect(rows(d, [outside], true, d)).toEqual([outside.message])
      const old = { path: 'parts.a.cognitiveLevel', message: 'Bahagian (a) belum ada aras pemikiran.' }
      expect(rows(d, [old], true, d)).toEqual([old.message])
    })

    it('an issue the form has since fixed drops out, including a removed leaf and the Kertas', () => {
      const stored = { ...tagged(), kertas: '' as const }
      const d = tagged()
      expect(rows(d, [{ path: 'kertas', message: 'Sila pilih kertas untuk soalan SPM.' }], true, stored)).toEqual([])
      const chapter = { path: 'chapterId', message: 'Sila pilih Bab.' }
      expect(rows({ ...d, chapterId: '12' }, [chapter], true, d)).toEqual([])
      expect(rows(d, [chapter], true, d)).toEqual([chapter.message])
      const renamed = tagged()
      renamed.leaves[0]!.label = 'c'
      expect(rows(renamed, [{ path: 'parts.a.cognitiveLevel', message: 'x' }], true, d)).toEqual([])
    })

    it('Bab is listed where the Subjek + Tingkatan has chapters, before any save (AC-ADM-QE4.4)', () => {
      expect(rows(tagged(), null, true, null, true)).toEqual(['Sila pilih Bab.'])
      expect(rows(tagged(), null, true, null, false)).toEqual([])
    })

    it('a leaf without its own TP inherits the highest of the leaves, as the gate does', () => {
      const d = tagged()
      d.leaves.push({ ...d.leaves[0]!, uid: 'x', label: 'b', tp: null })
      expect(rows(d, null)).toEqual([])
    })

    it('a server-only gap stays, with its link; the question TP row yields to the leaf row', () => {
      const d = tagged()
      d.leaves[0]!.tp = null
      const out = completenessRows({
        draft: d,
        gaps: draftGaps(d),
        issues: [
          { path: 'tp', message: 'Sila pilih tahap penguasaan (TP).' },
          { path: 'parts.a.difficultyTp', message: 'Bahagian (a) belum ada TP.' },
          { path: 'marks', message: 'Markah tidak sepadan.' },
        ],
        stored: d,
        hasDskp: true,
      })
      expect(out.map((r) => r.message)).toEqual(['Bahagian (a) belum ada TP.', 'Markah tidak sepadan.'])
      expect(out[0]?.field).toBe('studio-leaf-0')
    })

    it('a label with brackets or a dot keeps one row and the right leaf', () => {
      const d = tagged()
      d.leaves[0]!.label = '(a)'
      d.leaves[0]!.tp = null
      expect(draftGaps(d).find((g) => g.dskp === true)).toMatchObject({ message: 'Bahagian (a) belum ada TP.', field: 'studio-leaf-0' })
      expect(issueField('parts.1.1.cognitiveLevel', [{ label: '1' }, { label: '1.1' }])).toBe('studio-leaf-1')
      expect(issueField('parts.1.cognitiveLevel', [{ label: 'b' }, { label: '1' }])).toBe('studio-leaf-1')
    })
  })
})
