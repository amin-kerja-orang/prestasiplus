/**
 * T-B9-7 pure transform of canonical-only questions, T-B10-2/3 pure helpers (blueprint plan, group integrity of a paper).
 */
import { describe, expect, it } from 'vitest'

import { canonicalStatus, leafModeOf, questionTypeOf, textOfJson, transformCanonical, type CanonicalPart, type CanonicalQuestion } from '../../../src/migration/load/questions/canonical-plan'
import { hashOfPlan, planBlueprint, type PaperStats } from '../../../src/migration/load/papers/blueprints-step'
import { normaliseGroups, type SectionPlan } from '../../../src/migration/load/papers/papers-step'
import { allowedModesOf, instructionsOf, kertasOf, median, referenceSheetsOf, ruleTypeOf } from '../../../src/migration/load/papers/plan'
import { orderedMembers, planSet } from '../../../src/migration/load/spm-sets/steps'
import type { Curriculum } from '../../../src/migration/transform/question-bank'

const cur: Curriculum = {
  subjects: new Map([['1', '11']]),
  levels: new Map(),
  chapters: new Map(),
  topics: new Map(),
  levelCodes: new Map(),
  topicChapter: new Map(),
}

const mcqPart = (over: Record<string, unknown> = {}): CanonicalPart =>
  ({
    id: '1', parent_part_id: null, position: '1', label: '1', prompt: JSON.stringify({ ms: 'Pilih satu.' }), marks: '1', word_limit: null, config: null, mode_slug: 'mcq',
    options: [
      { id: '1', label: 'A', body: JSON.stringify({ ms: 'Satu' }), is_correct: '1', position: '1' },
      { id: '2', label: 'B', body: JSON.stringify({ ms: 'Dua' }), is_correct: '0', position: '2' },
    ],
    key_kind: 'single_key', key_content: null, ...over,
  }) as unknown as CanonicalPart
const cq = (over: Record<string, unknown> = {}, parts: CanonicalPart[] = [mcqPart()]): CanonicalQuestion =>
  ({ id: '500', status_slug: 'approved', subject_ref: '1', stem: JSON.stringify({ ms: 'Soalan contoh kanonik.' }), number_label: '3', parts, stimulus_ids: [], created_at: '2025-01-01T00:00:00Z', ...over }) as unknown as CanonicalQuestion

describe('canonical helpers', () => {
  it('maps status slugs and answer modes', () => {
    expect(['approved', 'published', 'draft', 'reviewed', 'archived', 'zzz'].map(canonicalStatus)).toEqual(['approved', 'approved', 'draft', 'review', 'archived', null])
    expect(['mcq', 'extended_essay', 'working_shown', 'draw_on_diagram', 'cloze'].map(leafModeOf)).toEqual(['mcq', 'essay', 'working', 'drawing', 'working'])
    expect(['numbered_list', 'essay_choice', 'table_fill', 'zzz'].map(leafModeOf)).toEqual(['essay', 'essay', 'working', null])
  })

  it('reads the text of a JSON value of every known shape', () => {
    expect(textOfJson('{"ms":"Satu","en":"One"}')).toBe('Satu')
    expect(textOfJson('"Terus"')).toBe('Terus')
    expect(textOfJson('[{"type":"p","text":"Baris 1"},{"type":"p","text":"Baris 2"}]')).toBe('Baris 1\nBaris 2')
    expect(textOfJson('{"type":"doc","content":[{"type":"p","content":[{"text":"Dalam"}]}]}')).toBe('Dalam')
    expect(textOfJson('{"html":"<p>Satu <b>dua</b></p>"}')).toBe('Satu dua')
    expect(textOfJson(JSON.stringify(JSON.stringify({ html: 'Dua kali' })))).toBe('Dua kali')
    expect(textOfJson('{"x":1}')).toBeNull()
    expect(textOfJson(null)).toBeNull()
  })

  it('classifies the question type from the tree', () => {
    expect(questionTypeOf([{ kind: 'leaf', label: '1', prompt: 'p', marks: 1, mode: 'mcq', key: { kind: 'option', correct: 'A' } }])).toBe('mcq')
    expect(questionTypeOf([{ kind: 'branch', label: '(a)', prompt: 'p', children: [] }])).toBe('structured')
  })
})

describe('transformCanonical', () => {
  it('builds an MCQ from the is_correct flag, keeps the V2 status and has no education level', () => {
    const out = transformCanonical(cq(), cur, new Map())
    expect(out.ok).toBe(true)
    if (!out.ok) return
    expect(out.value).toMatchObject({ idEntity: 'exam_questions', idKey: '500', legacyId: null, type: 'mcq', status: 'approved', education_level_id: null, number_label: '3', subject_id: '11' })
    expect(out.value.tree[0]).toMatchObject({ kind: 'leaf', mode: 'mcq', key: { kind: 'option', correct: 'A' } })
    expect(out.value.notes).toContain('level_missing')
  })

  it('an SPM canonical question is a Tingkatan 5 question when the curriculum has that level', () => {
    const withT5: Curriculum = { ...cur, levelCodes: new Map([['21', 'T4'], ['22', 'T5']]) }
    const out = transformCanonical(cq(), withT5, new Map())
    expect(out.ok && out.value).toMatchObject({ education_level_id: '22', form_origin: 't5' })
    expect(out.ok && out.value.notes).toContain('level_from_spm_paper')
  })

  it('links only the stimuli the stimulus pass mapped (max 3)', () => {
    const out = transformCanonical(cq({ stimulus_ids: ['1', '2', '3', '4', '5'] }), cur, new Map([['1', '101'], ['2', '102'], ['3', '103'], ['4', '104']]))
    expect(out.ok && out.value.stimulusIds).toEqual(['101', '102', '103'])
    expect(out.ok && out.value.notes).toEqual(expect.arrayContaining(['stimulus_not_loaded', 'stimulus_cut_to_3']))
  })

  it('translates an essay with mark-scheme points and a short text with accepted values', () => {
    const essay = mcqPart({ id: '2', mode_slug: 'extended_essay', options: [], marks: '2', key_content: JSON.stringify({ points: [{ text: 'Isi satu', marks: 1 }, { text: 'Isi dua', marks: 1 }] }) })
    const short = mcqPart({ id: '3', position: '2', label: '2', mode_slug: 'short_text', options: [], key_content: JSON.stringify(['jawapan']) })
    const out = transformCanonical(cq({}, [essay, short]), cur, new Map())
    expect(out.ok).toBe(true)
    if (!out.ok) return
    expect(out.value.type).toBe('structured')
    expect(out.value.tree[0]).toMatchObject({ mode: 'essay', key: { kind: 'points', marks: 2 } })
    expect(out.value.tree[1]).toMatchObject({ mode: 'short_text', key: { kind: 'accepted', values: ['jawapan'] } })
  })

  it('nests a part under its parent and refuses depth over 3', () => {
    const root = mcqPart({ id: '10', mode_slug: 'mcq' })
    const branch = { ...root, id: '10', options: [], mode_slug: null } as unknown as CanonicalPart
    const child = mcqPart({ id: '11', parent_part_id: '10', label: '(i)' })
    const ok = transformCanonical(cq({}, [branch, child]), cur, new Map())
    expect(ok.ok && ok.value.tree[0]).toMatchObject({ kind: 'branch', children: [{ kind: 'leaf', label: '(i)' }] })
  })

  it('rejects, never invents: no correct option, no key, unknown mode, unknown status, no subject, unreadable stem', () => {
    const none = mcqPart({ options: [{ id: '1', label: 'A', body: '"x"', is_correct: '0', position: '1' }, { id: '2', label: 'B', body: '"y"', is_correct: '0', position: '2' }] })
    const reason = (row: CanonicalQuestion): string | null => {
      const out = transformCanonical(row, cur, new Map())
      return out.ok ? null : `${out.reject.reason}:${out.reject.column}`
    }
    expect(reason(cq({}, [none]))).toBe('INVALID_VALUE:is_correct')
    expect(reason(cq({}, [mcqPart({ mode_slug: 'zzz', options: [] })]))).toBe('INVALID_VALUE:answer_mode')
    expect(reason(cq({ status_slug: 'zzz' }))).toBe('UNKNOWN_ENUM:status_id')
    expect(reason(cq({ subject_ref: null }))).toBe('ORPHAN_PARENT:subject_id')
    expect(reason(cq({ stem: '{"x":1}' }, [mcqPart({ prompt: null })]))).toBe('INVALID_VALUE:stem')
    expect(reason(cq({}, []))).toBe('INVALID_VALUE:parts')
  })
})

describe('transformCanonical on the real V2 shapes', () => {
  const html = (v: string): string => JSON.stringify({ html: v })
  const part = (over: Record<string, unknown> = {}): CanonicalPart => mcqPart({ prompt: null, options: [], ...over })

  it('reads {html} stems, prompts and option bodies, and takes the answer from the single_key row when no option carries the flag', () => {
    const opts = [
      { id: '71', label: 'A', body: html('<p>Satu</p>'), is_correct: '0', position: '1' },
      { id: '72', label: 'B', body: html('Dua'), is_correct: '0', position: '2' },
      { id: '73', label: 'C', body: html(''), is_correct: '0', position: '3' },
    ]
    const out = transformCanonical(cq({ stem: html('<p>Berapakah <b>isi</b> padu?</p>') }, [mcqPart({ prompt: html('Pilih.'), options: opts, key_content: JSON.stringify({ option_id: 72 }) })]), cur, new Map())
    expect(out.ok).toBe(true)
    if (!out.ok) return
    expect(out.value.stem).toBe('Berapakah isi padu?')
    expect(out.value.tree[0]).toMatchObject({ kind: 'leaf', mode: 'mcq', key: { kind: 'option', correct: 'B' }, options: [{ label: 'A', body: 'Satu' }, { label: 'B', body: 'Dua' }, { label: 'C', body: 'C' }] })
    expect(out.value.notes).toEqual(expect.arrayContaining(['key_from_single_key', 'option_body_empty']))
  })

  it('reads the mark-scheme shape of V2 ({point, marks}), a model answer ({text}) and a rubric of an unknown shape', () => {
    const pts = part({ id: '2', mode_slug: 'extended_essay', marks: '2', key_content: JSON.stringify({ points: [{ point: 'Isi satu', marks: 1 }, { point: 'Isi dua', marks: 1 }] }) })
    const model = part({ id: '3', position: '2', label: '2', mode_slug: 'extended_essay', marks: '3', key_content: JSON.stringify({ text: 'Jawapan model.' }) })
    const rubric = part({ id: '4', position: '3', label: '3', mode_slug: 'extended_essay', marks: '4', key_content: JSON.stringify({ bands: [{ band: 'Cemerlang', desc: 'Huraian lengkap' }] }) })
    const out = transformCanonical(cq({}, [pts, model, rubric]), cur, new Map())
    expect(out.ok).toBe(true)
    if (!out.ok) return
    expect(out.value.tree[0]).toMatchObject({ key: { kind: 'points', marks: 2, points: [{ marks: 1 }, { marks: 1 }] } })
    expect(out.value.tree[1]).toMatchObject({ key: { kind: 'points', modelText: 'Jawapan model.' } })
    expect(out.value.tree[2]).toMatchObject({ key: { kind: 'points', modelText: expect.stringContaining('Huraian lengkap') } })
  })

  it('a leaf with no key is a placeholder scheme: a draft stays a draft, an approved question goes to review, and no short answer is rejected for it', () => {
    const draft = transformCanonical(cq({ status_slug: 'draft' }, [part({ mode_slug: 'short_text' })]), cur, new Map())
    expect(draft.ok && draft.value).toMatchObject({ status: 'draft', is_active: true, tree: [{ mode: 'working', key: { kind: 'points' } }] })
    expect(draft.ok && draft.value.import_issues).toEqual([{ code: 'scheme_placeholder', target: 'part', label: '1' }])
    const approved = transformCanonical(cq({}, [part({ mode_slug: 'extended_essay' })]), cur, new Map())
    expect(approved.ok && approved.value.status).toBe('review')
    expect(approved.ok && approved.value.notes).toContain('approved_to_review_no_scheme')
  })

  it('an empty stem takes the first part prompt; no text anywhere is a reject', () => {
    const ok = transformCanonical(cq({ stem: html('') }, [mcqPart({ prompt: html('Isi petak kosong.') })]), cur, new Map())
    expect(ok.ok && ok.value.stem).toBe('Isi petak kosong.')
    expect(ok.ok && ok.value.notes).toContain('stem_from_part')
  })
})

describe('paper plan helpers', () => {
  it('reads kertas, rule, median, instructions, reference sheets and modes', () => {
    expect(['2', 'K3', 'Kertas 1', '', 'x', '9'].map(kertasOf)).toEqual([2, 3, 1, null, null, null])
    expect(['answer_all', 'choose_n', 'weird'].map(ruleTypeOf)).toEqual(['all', 'choose', null])
    expect([median([]), median([3]), median([1, 2, 9]), median([1, 2, 3, 10])]).toEqual([null, 3, 2, 3])
    expect(instructionsOf('["Jawab semua.","  "]')).toEqual(['Jawab semua.'])
    expect(referenceSheetsOf('[{"title":"Rumus","items":["a","b"]}]')).toEqual([{ title: 'Rumus', items: ['a', 'b'] }])
    expect(referenceSheetsOf('[{"title":"Rumus"}]')).toEqual([])
    expect(allowedModesOf('["mcq","cloze","extended_essay"]')).toEqual({ modes: ['mcq', 'essay'], dropped: 1 })
  })
})

describe('planBlueprint', () => {
  const stats: PaperStats = { durations: new Map([['1|2', [120, 150, 180]]]), sectionCounts: new Map([['1|2', new Map([[1, [10, 12]], [2, [4]]])]]) }
  const rules = new Map([['1', 'answer_all'], ['2', 'choose_n']])
  const bp = (over: Record<string, unknown> = {}) => ({ id: '3', subject_id: '1', kertas: '2', paper_code: '1449/2', duration_minutes: '150', total_marks: '100', auto_markable: '1', source: 'confirmed', ...over })
  const sec = (id: number, position: number, rule: string, over: Record<string, unknown> = {}) => ({ id: String(id), label: `Bahagian ${position}`, position: String(position), selection_rule_id: rule, ...over })

  it('confirmed is spec (never verified); question count from select_count, else the median of the V2 papers', () => {
    const out = planBlueprint({ row: bp(), sections: [sec(1, 1, '1'), sec(2, 2, '2', { select_count: '2' })], subjectCode: 'MATH', stats, ruleSlugs: rules }, cur.subjects)
    expect(out.ok).toBe(true)
    if (!out.ok) return
    expect(out.value).toMatchObject({ source: 'spec', kertas: 2, code: '1449/2', duration_min: 150 })
    expect(out.value.sections.map((s) => [s.rule_type, s.rule_n, s.question_count])).toEqual([['all', null, 11], ['choose', 2, 4]])
    expect(out.value.notes).toContain('confirmed_as_spec')
    expect(hashOfPlan(out.value, 'MATH')).toMatch(/^[0-9a-f]{64}$/)
  })

  it('a missing duration comes from the papers, else it is a reject; a section that cannot be sized drops all sections', () => {
    const fromPapers = planBlueprint({ row: bp({ duration_minutes: null, source: 'derived' }), sections: [], subjectCode: 'MATH', stats, ruleSlugs: rules }, cur.subjects)
    expect(fromPapers.ok && [fromPapers.value.duration_min, fromPapers.value.source, fromPapers.value.notes]).toEqual([150, 'draft', expect.arrayContaining(['duration_from_papers', 'blueprint_no_sections'])])
    const none = planBlueprint({ row: bp({ duration_minutes: null, kertas: '3' }), sections: [], subjectCode: 'MATH', stats, ruleSlugs: rules }, cur.subjects)
    expect(none.ok).toBe(false)
    const unsized = planBlueprint({ row: bp(), sections: [sec(1, 1, '1'), sec(2, 5, '1')], subjectCode: 'MATH', stats: { durations: stats.durations, sectionCounts: new Map() }, ruleSlugs: rules }, cur.subjects)
    expect(unsized.ok && unsized.value.sections).toEqual([])
  })
})

describe('normaliseGroups', () => {
  const p = (id: string) => ({ question_id: id, number_label: null, marks_override: null })
  const section = (ids: string[]): SectionPlan => ({ label: 'A', instruction: null, rule_type: 'all', rule_n: null, mark_budget: null, placements: ids.map(p) })
  const facts = { groupOf: new Map([['1', 'g'], ['2', 'g'], ['3', 'g']]), members: new Map([['g', ['1', '2', '3']]]) }

  it('moves the members of a group next to each other in group order, at the place of the first', () => {
    const out = normaliseGroups([section(['1', '9', '3', '8', '2'])], facts)
    expect(out.split).toBe(false)
    expect(out.sections[0]?.placements.map((x) => x.question_id)).toEqual(['1', '2', '3', '9', '8'])
  })

  it('a group with a missing member or members in two sections is split (the paper is held)', () => {
    expect(normaliseGroups([section(['1', '2'])], facts).split).toBe(true)
    expect(normaliseGroups([section(['1', '2']), section(['3'])], facts).split).toBe(true)
  })

  it('a paper without groups is untouched', () => {
    const out = normaliseGroups([section(['5', '4'])], { groupOf: new Map(), members: new Map() })
    expect(out.split).toBe(false)
    expect(out.sections[0]?.placements.map((x) => x.question_id)).toEqual(['5', '4'])
  })
})

describe('spm sets', () => {
  it('plans the natural key and orders members by position, NULL last', () => {
    const ok = planSet({ id: '4', subject_id: '1', year: '2024', set_number: '2' }, cur.subjects)
    expect(ok.ok && ok.value).toMatchObject({ subject_id: '11', year: 2024, set_no: 2 })
    expect(planSet({ id: '4', subject_id: '9', year: '2024', set_number: '2' }, cur.subjects).ok).toBe(false)
    expect(planSet({ id: '4', subject_id: '1', year: 'x', set_number: '2' }, cur.subjects).ok).toBe(false)
    const ordered = orderedMembers([{ question_id: '5', position: null }, { question_id: '3', position: '2' }, { question_id: '4', position: '1' }, { question_id: '2', position: null }])
    expect(ordered.map((m) => m.question_id)).toEqual(['4', '3', '2', '5'])
  })
})
