/**
 * T-B9-6 pure transform: structured and subjective plans (labels, key, mode, status, rejects). Synthetic text only.
 */
import { describe, expect, it } from 'vitest'

import type { Curriculum } from '../../../src/migration/transform/question-bank'
import { buildPointsKey, kbatOf, labelPathOf, modeOfMarks, statusOf, transformStructured as ts, transformSubjective as tj, type LegacyStructured } from '../../../src/migration/load/questions/structured-plan'

const cur: Curriculum = {
  subjects: new Map([['1', '11']]),
  levels: new Map([['1', '21'], ['2', '22']]),
  chapters: new Map([['1', '31']]),
  topics: new Map(),
  levelCodes: new Map([['21', 'T4'], ['22', 'D1']]),
  topicChapter: new Map(),
}

const transformStructured = (r: LegacyStructured) => ts(r, cur)
const transformSubjective = (r: Record<string, unknown>) => tj(r as never, cur)

const sub = (id: number, number: string, marks: number, scheme: string | null = 'Skema contoh.', rubric: { text: string; marks: number }[] = []) => ({
  id: String(id),
  number,
  body: `Sub soalan ${number}`,
  marks: String(marks),
  scheme,
  rubric: rubric.map((r, i) => ({ id: String(id * 10 + i), code: 'A1', text: r.text, marks: String(r.marks), position: String(i) })),
})
const q = (over: Record<string, unknown> = {}, subs = [sub(1, '(a)', 2)]): LegacyStructured =>
  ({ id: '7', subject_id: '1', education_level_id: '1', status: 'diluluskan', stimulus: 'Petikan contoh.', kbat_level: 'menganalisis', total_marks: '2', created_at: '2025-01-01T00:00:00Z', ...over, subs }) as unknown as LegacyStructured

describe('status and labels', () => {
  it('maps the V2 statuses of design 4.1', () => {
    expect(statusOf('diluluskan')).toEqual({ status: 'approved', rejection: null })
    expect(statusOf('diarkib')?.status).toBe('archived')
    expect(statusOf('draf')?.status).toBe('draft')
    expect(statusOf('ditolak')).toEqual({ status: 'draft', rejection: 'Ditolak di V2.' })
    expect(statusOf('menunggu')?.status).toBe('review')
    expect(statusOf('xyz')).toBeNull()
  })

  it('parses sub-question numbers into label paths', () => {
    expect(labelPathOf('(a)')).toEqual(['(a)'])
    expect(labelPathOf('1(a)')).toEqual(['(a)'])
    expect(labelPathOf('(a)(i)')).toEqual(['(a)', '(i)'])
    expect(labelPathOf('2.')).toEqual(['2'])
    expect(labelPathOf(' b ')).toEqual(['b'])
  })

  it('1 to 2 marks is working, 3 or more essay (a points key cannot sit on short_text)', () => {
    expect([1, 2, 3, 6].map(modeOfMarks)).toEqual(['working', 'working', 'essay', 'essay'])
  })

  it('KBAT is kept only for the four DSKP levels', () => {
    expect(kbatOf('Menganalisis')).toBe('menganalisis')
    expect(kbatOf('lots')).toBeNull()
  })
})

describe('buildPointsKey', () => {
  it('rubric points that sum to the marks become the key points and the Skema is modelText', () => {
    const { key, placeholder } = buildPointsKey(3, 'Skema.', [{ text: 'Titik satu', marks: 1 }, { text: 'Titik dua', marks: 2 }])
    expect(placeholder).toBe(false)
    expect(key).toMatchObject({ kind: 'points', marks: 3, modelText: 'Skema.' })
    expect((key.points as { id: string; marks: number }[]).map((p) => [p.id, p.marks])).toEqual([['p1', 1], ['p2', 2]])
  })

  it('a rubric that does not sum to the marks becomes one point with the texts in modelText', () => {
    const r = buildPointsKey(4, null, [{ text: 'A', marks: 1 }, { text: 'B', marks: 1 }])
    expect(r.notes).toContain('rubric_sum_mismatch')
    expect(r.key.points).toHaveLength(1)
    expect(r.key.modelText).toBe('A\nB')
  })

  it('no scheme and no rubric is a placeholder', () => {
    const r = buildPointsKey(2, null, [])
    expect(r.placeholder).toBe(true)
    expect((r.key.points as { label: string }[])[0]?.label).toBe('Skema belum disediakan')
  })
})

describe('transformStructured', () => {
  it('builds one leaf per sub-question with the points key and declared marks', () => {
    const out = transformStructured(q())
    expect(out.ok).toBe(true)
    if (!out.ok) return
    const p = out.value
    expect(p).toMatchObject({ type: 'structured', status: 'approved', idEntity: 'structured_questions', idKey: '7', kbat: 'menganalisis', declared_marks: 2, is_active: true, form_origin: 't4' })
    expect(p.tree).toHaveLength(1)
    expect(p.tree[0]).toMatchObject({ kind: 'leaf', label: '(a)', marks: 2, mode: 'working' })
  })

  it('nests (a)(i) under a branch (a) only when no plain (a) sub-question exists', () => {
    const nested = transformStructured(q({ total_marks: '3' }, [sub(1, '(a)(i)', 1), sub(2, '(a)(ii)', 2), sub(3, '(b)', 3)]).valueOf() as LegacyStructured)
    // 1 + 2 + 3 = 6, total_marks 3 mismatches: declared null
    expect(nested.ok).toBe(true)
    if (!nested.ok) return
    expect(nested.value.tree.map((n) => [n.kind, n.label])).toEqual([['branch', '(a)'], ['leaf', '(b)']])
    expect(nested.value.declared_marks).toBeNull()
    expect(nested.value.notes).toContain('marks_mismatch')
    const flat = transformStructured(q({ total_marks: '6' }, [sub(1, '(a)', 1), sub(2, '(a)(i)', 2), sub(3, '(a)(ii)', 3)]))
    expect(flat.ok).toBe(true)
    if (!flat.ok) return
    expect(flat.value.notes).toContain('label_flat')
    expect(flat.value.tree.every((n) => n.kind === 'leaf')).toBe(true)
  })

  it('keeps the whole number when stripping the question number would collide', () => {
    const out = transformStructured(q({ total_marks: '2' }, [sub(1, '1(a)', 1), sub(2, '2(a)', 1)]))
    expect(out.ok).toBe(true)
    if (!out.ok) return
    expect(out.value.notes).toContain('label_kept_number')
    expect(out.value.tree.map((n) => n.label)).toEqual(['1(a)', '2(a)'])
  })

  it('an approved question with no scheme is loaded as review, with the placeholder issue', () => {
    const out = transformStructured(q({}, [sub(1, '(a)', 2, null)]))
    expect(out.ok).toBe(true)
    if (!out.ok) return
    expect(out.value.status).toBe('review')
    expect(out.value.notes).toContain('approved_to_review_no_scheme')
    expect(out.value.import_issues).toEqual([{ code: 'scheme_placeholder', target: 'part', label: '(a)' }])
    expect(out.value.is_active).toBe(true)
  })

  it('keeps archived, draft and menunggu statuses; the ditolak row gets its reason', () => {
    const archived = transformStructured(q({ status: 'diarkib' }))
    const rejected = transformStructured(q({ status: 'ditolak' }))
    expect(archived.ok && archived.value.status).toBe('archived')
    expect(rejected.ok && [rejected.value.status, rejected.value.rejection_reason]).toEqual(['draft', 'Ditolak di V2.'])
  })

  it('rejects an unknown status, an orphan subject or level, an empty stem and a question with no sub-question', () => {
    const bad = (over: Record<string, unknown>, subs?: ReturnType<typeof sub>[]) => {
      const out = transformStructured(q(over, subs))
      return out.ok ? null : [out.reject.reason, out.reject.column]
    }
    expect(bad({ status: 'xyz' })).toEqual(['UNKNOWN_ENUM', 'status'])
    expect(bad({ subject_id: '99' })).toEqual(['ORPHAN_PARENT', 'subject_id'])
    expect(bad({ education_level_id: '99' })).toEqual(['ORPHAN_PARENT', 'education_level_id'])
    expect(bad({ stimulus: '  ' })).toEqual(['INVALID_VALUE', 'stimulus'])
    expect(bad({}, [])).toEqual(['INVALID_VALUE', 'sub_questions'])
  })

  it('holds a question whose text carries personal data', () => {
    const out = transformStructured(q({ stimulus: 'Hubungi 012-3456789 untuk soalan ini.' }))
    expect(out.ok && out.value.is_active).toBe(false)
    expect(out.ok && out.value.import_issues?.some((i) => i.code === 'pii_suspect')).toBe(true)
  })
})

describe('transformSubjective', () => {
  const row = (over: Record<string, unknown> = {}) => ({ id: '9', subject_id: '1', education_level_id: '2', status: 'diarkib', type: 'subjektif', body: 'Huraikan satu contoh.', explanation: 'Jawapan model contoh.', created_at: '2025-01-01T00:00:00Z', ...over })

  it('is an archived essay with one essay leaf and the explanation as the model point', () => {
    const out = transformSubjective(row())
    expect(out.ok).toBe(true)
    if (!out.ok) return
    expect(out.value).toMatchObject({ type: 'essay', status: 'archived', idEntity: 'questions', legacyId: '9', form_origin: 't1_t3', declared_marks: null })
    expect(out.value.tree[0]).toMatchObject({ kind: 'leaf', label: '1', marks: 1, mode: 'essay' })
    expect(out.value.notes).toContain('marks_unknown')
  })

  it('keeps the real V2 status; an approved one with no explanation becomes review (cannot be marked)', () => {
    const kept = transformSubjective(row({ status: 'draf' }))
    expect(kept.ok && kept.value.status).toBe('draft')
    const none = transformSubjective(row({ status: 'diluluskan', explanation: null }))
    expect(none.ok && none.value.status).toBe('review')
    const ok = transformSubjective(row({ status: 'diluluskan' }))
    expect(ok.ok && ok.value.status).toBe('approved')
  })

  it('an image is a held image (inactive) until the image pass resolves it', () => {
    const out = transformSubjective(row({ image_path: 'q/rajah.png' }))
    expect(out.ok && out.value.is_active).toBe(false)
    expect(out.ok && out.value.import_issues?.[0]).toEqual({ code: 'legacy_image_unresolved', target: 'question', path: 'q/rajah.png' })
  })

  it('rejects an empty body and an orphan subject', () => {
    const a = transformSubjective(row({ body: null }))
    const b = transformSubjective(row({ subject_id: '99' }))
    expect(a.ok).toBe(false)
    expect(b.ok).toBe(false)
  })
})
