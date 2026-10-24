/**
 * `transformQuestion` / `exclusionOf` (QLOAD): pure rules, synthetic rows only.
 */
import { QuestionLeafPartSchema } from '@pp/contract'
import { describe, expect, it } from 'vitest'

import { mapQuestionType } from '../../../src/migration/snapshot-dims/dims'

import {
  exclusionOf,
  formOriginOf,
  normaliseLabels,
  transformQuestion,
  type Curriculum,
  type LegacyOption,
  type LegacyQuestion,
} from '../../../src/migration/transform/question-bank'

const cur: Curriculum = {
  subjects: new Map([['1', '101']]),
  levels: new Map([['1', '201'], ['2', '204'], ['3', '205'], ['4', '206']]),
  chapters: new Map([['1', '301'], ['2', '302']]),
  topics: new Map([['1', '401'], ['2', '402']]),
  levelCodes: new Map([['201', 'D1'], ['204', 'T4'], ['205', 'T5'], ['206', 'T2']]),
  topicChapter: new Map([['401', '301'], ['402', '302']]),
}

const opt = (label: string | null, body: string | null, correct: string | null): LegacyOption => ({ id: null, label, body, is_correct: correct })
const four = (): LegacyOption[] => [opt('A', 'Satu', '0'), opt('B', 'Dua', '1'), opt('C', 'Tiga', '0'), opt('D', 'Empat', '0')]
const row = (over: Record<string, string | null> = {}, options: LegacyOption[] = four()): LegacyQuestion => ({
  id: '7', subject_id: '1', education_level_id: '1', chapter_id: '1', topic_id: '1', difficulty_level: '3', type: 'mcq', status: 'diluluskan',
  body: 'Soalan contoh?', explanation: 'Sebab.', image_path: null, created_at: '2025-01-02T03:04:05Z', updated_at: '2025-02-03T04:05:06Z', ...over, options,
}) as unknown as LegacyQuestion
const plan = (r: LegacyQuestion) => {
  const out = transformQuestion(r, cur)
  if (!out.ok) throw new Error(`rejected: ${out.reject.reason} ${out.reject.column}`)
  return out.value
}
const rejected = (r: LegacyQuestion) => {
  const out = transformQuestion(r, cur)
  if (out.ok) throw new Error('expected a reject')
  return `${out.reject.reason}:${out.reject.column}`
}

describe('exclusionOf', () => {
  it('keeps approved MCQs in scope and names the first reason otherwise', () => {
    expect(exclusionOf(row())).toBeNull()
    expect(exclusionOf(row({ status: ' Diluluskan ' }))).toBeNull()
    expect(exclusionOf(row({ type: 'pilihan_berganda' }))).toBeNull()
    expect(exclusionOf(row({ status: 'draf' }))).toEqual({ by: 'status', code: 'draf' })
    expect(exclusionOf(row({ status: 'ditolak', type: 'subjective' }))).toEqual({ by: 'status', code: 'ditolak' })
    expect(exclusionOf(row({ type: 'subjective' }))).toEqual({ by: 'type', code: 'subjective' })
    expect(exclusionOf(row({ status: null }))).toEqual({ by: 'status', code: 'null' })
    // Free text never becomes a counter name.
    expect(exclusionOf(row({ status: 'Teks bebas yang sangat panjang melebihi tiga puluh dua huruf sekali' }))).toEqual({ by: 'status', code: 'other' })
  })
})

describe('transformQuestion: the happy path', () => {
  it('builds a published single-part MCQ plan', () => {
    const p = plan(row())
    expect(p).toMatchObject({
      legacyId: '7', subject_id: '101', education_level_id: '201', chapter_id: '301', topic_id: '401', form_origin: 't1_t3',
      difficulty_tp: 3, stem: 'Soalan contoh?', explanation: 'Sebab.', correct: 'B', spm_pool: false, is_active: true, import_issues: null,
      published_at: '2025-02-03T04:05:06Z', created_at: '2025-01-02T03:04:05Z',
    })
    expect(p.options.map((o) => `${o.position}${o.label}${o.body}`)).toEqual(['1ASatu', '2BDua', '3CTiga', '4DEmpat'])
    expect(p.notes).toEqual([])
    // The very leaf the contract (and the v2 reader) accepts.
    expect(QuestionLeafPartSchema.safeParse({ label: '1', prompt: { ms: p.stem }, marks: 1, mode: 'mcq', options: p.options.map((o) => ({ label: o.label, body: { ms: o.body } })), key: { kind: 'option', correct: p.correct } }).success).toBe(true)
  })

  it('maps difficulty 1 to 5 as is; anything else is empty and counted', () => {
    for (const d of ['1', '2', '3', '4', '5']) expect(plan(row({ difficulty_level: d })).difficulty_tp).toBe(Number(d))
    for (const d of ['0', '6', 'mudah', null, '']) {
      const p = plan(row({ difficulty_level: d }))
      expect(p.difficulty_tp).toBeNull()
      expect(p.notes).toContain('difficulty_missing')
    }
  })

  it('form origin and SPM pool tag follow the v2 level code (T4 and T5 only)', () => {
    expect(formOriginOf('T5')).toBe('t5')
    expect(formOriginOf('T4')).toBe('t4')
    expect(formOriginOf('D3')).toBe('t1_t3')
    expect(formOriginOf('LVL9')).toBe('t1_t3')
    expect(formOriginOf(undefined)).toBe('t1_t3')
    expect(plan(row({ education_level_id: '2' }))).toMatchObject({ form_origin: 't4', spm_pool: true })
    expect(plan(row({ education_level_id: '3' }))).toMatchObject({ form_origin: 't5', spm_pool: true })
    expect(plan(row({ education_level_id: '4' }))).toMatchObject({ form_origin: 't1_t3', spm_pool: false })
    expect(plan(row({ education_level_id: '1' })).spm_pool).toBe(false)
  })

  it('an empty explanation is empty; the stem is trimmed', () => {
    const p = plan(row({ explanation: '   ', body: '  Soalan?  ' }))
    expect(p.explanation).toBeNull()
    expect(p.stem).toBe('Soalan?')
  })

  it('converts a known small tag set to plain text and counts it', () => {
    const p = plan(row({ body: '<p>Nilai <b>x</b><sup>2</sup> + H<sub>2</sub>O &amp; lain</p><p>Kira.<br/>Cepat&nbsp;&lt;3 minit</p>', explanation: '<p>Sebab <em>ini</em>.</p>' }, [opt('A', '<span style="x">Satu</span>', '0'), opt('B', 'Dua<sup>k+1</sup>', '1'), opt('C', 'Tiga', '0')]))
    expect(p.stem).toBe('Nilai x\u00b2 + H\u2082O & lain\nKira.\nCepat <3 minit')
    expect(p.options.map((o) => o.body)).toEqual(['Satu', 'Dua^(k+1)', 'Tiga'])
    expect(p.explanation).toBe('Sebab ini.')
    expect(p.notes).toEqual(expect.arrayContaining(['html_stripped', 'explanation_html_stripped']))
    expect(p.notes).not.toContain('body_has_html')
  })

  it('leaves text without a known tag untouched, including a bare <', () => {
    const p = plan(row({ body: 'Jika x < y dan a<b maka 5 dan 6?', explanation: null }))
    expect(p.stem).toBe('Jika x < y dan a<b maka 5 dan 6?')
    expect(p.notes).not.toContain('html_stripped')
  })

  it('counts an unknown tag as body_has_html and does not alter it', () => {
    const p = plan(row({ body: '<table><tr><td>Soalan</td></tr></table>' }))
    expect(p.stem).toBe('<table><tr><td>Soalan</td></tr></table>')
    expect(p.notes).toContain('body_has_html')
  })

  it('rejects a body that is empty once its tags are gone', () => {
    const out = transformQuestion(row({ body: '<p><br/></p>' }), cur)
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.reject).toMatchObject({ reason: 'INVALID_VALUE', column: 'body' })
  })
})

describe('transformQuestion: curriculum', () => {
  it('chapter and topic are optional and counted when missing or unmapped', () => {
    expect(plan(row({ chapter_id: null, topic_id: null })).notes).toEqual(['chapter_missing'])
    const un = plan(row({ chapter_id: '99', topic_id: '98' }))
    expect(un).toMatchObject({ chapter_id: null, topic_id: null })
    expect(un.notes).toEqual(['topic_unmapped', 'chapter_unmapped'])
  })

  it('a topic of another chapter is dropped; a chapter missing is taken from the topic', () => {
    const mismatch = plan(row({ chapter_id: '1', topic_id: '2' }))
    expect(mismatch).toMatchObject({ chapter_id: '301', topic_id: null })
    expect(mismatch.notes).toEqual(['topic_chapter_mismatch'])
    const fromTopic = plan(row({ chapter_id: null, topic_id: '2' }))
    expect(fromTopic).toMatchObject({ chapter_id: '302', topic_id: '402' })
    expect(fromTopic.notes).toEqual(['chapter_from_topic'])
  })
})

describe('transformQuestion: rejects', () => {
  it('subject and level are required and must be mapped', () => {
    expect(rejected(row({ subject_id: null }))).toBe('ORPHAN_PARENT:subject_id')
    expect(rejected(row({ subject_id: '999' }))).toBe('ORPHAN_PARENT:subject_id')
    expect(rejected(row({ education_level_id: null }))).toBe('ORPHAN_PARENT:education_level_id')
    expect(rejected(row({ education_level_id: '999' }))).toBe('ORPHAN_PARENT:education_level_id')
  })

  it('a blank body is rejected', () => {
    expect(rejected(row({ body: '  ' }))).toBe('INVALID_VALUE:body')
    expect(rejected(row({ body: null }))).toBe('INVALID_VALUE:body')
  })

  it('3 to 8 options only (the contract minimum is 3)', () => {
    expect(rejected(row({}, []))).toBe('INVALID_VALUE:options')
    expect(rejected(row({}, four().slice(0, 2)))).toBe('INVALID_VALUE:options')
    const three = four().slice(0, 3)
    expect(plan(row({}, three)).options).toHaveLength(3)
    const eight = 'ABCDEFGH'.split('').map((l, i) => opt(l, `P${i}`, i === 7 ? '1' : '0'))
    expect(plan(row({}, eight)).correct).toBe('H')
    expect(rejected(row({}, [...eight, opt('I', 'Lebih', '0')]))).toBe('INVALID_VALUE:options')
  })

  it('a blank option body (an image-only option included) is rejected', () => {
    const o = four()
    o[2] = opt('C', '  ', '0')
    expect(rejected(row({}, o))).toBe('INVALID_VALUE:options.body')
  })

  it('exactly one correct option', () => {
    expect(rejected(row({}, four().map((o) => ({ ...o, is_correct: '0' }))))).toBe('INVALID_VALUE:is_correct')
    expect(rejected(row({}, four().map((o) => ({ ...o, is_correct: '1' }))))).toBe('INVALID_VALUE:is_correct')
    expect(rejected(row({}, four().map((o, i) => ({ ...o, is_correct: i === 0 ? 'mungkin' : '0' }))))).toBe('INVALID_VALUE:is_correct')
    expect(plan(row({}, four().map((o, i) => ({ ...o, is_correct: i === 3 ? 'true' : 'false' })))).correct).toBe('D')
  })

  it('labels: normalised, digits renumbered, bad and duplicate labels rejected', () => {
    expect(normaliseLabels(['a)', ' b. ', 'C', 'd'])).toEqual(['A', 'B', 'C', 'D'])
    expect(normaliseLabels(['1', '2', '3'])).toEqual(['A', 'B', 'C'])
    expect(normaliseLabels(['1', 'B', 'C'])).toEqual([null, 'B', 'C'])
    expect(normaliseLabels(['A', 'Z'])).toEqual(['A', null])
    expect(normaliseLabels([null])).toEqual([null])
    const digits = ['1', '2', '3', '4'].map((l, i) => opt(l, `P${i}`, i === 1 ? '1' : '0'))
    const p = plan(row({}, digits))
    expect(p.correct).toBe('B')
    expect(p.notes).toContain('label_renumbered')
    expect(rejected(row({}, four().map((o, i) => (i === 3 ? { ...o, label: 'Z' } : o))))).toBe('INVALID_VALUE:label')
    expect(rejected(row({}, four().map((o, i) => (i === 3 ? { ...o, label: null } : o))))).toBe('INVALID_VALUE:label')
    expect(rejected(row({}, four().map((o, i) => (i === 3 ? { ...o, label: 'a.' } : o))))).toBe('DUPLICATE_KEY:label')
  })

  it('positions follow the label order whatever the source order', () => {
    const shuffled = [opt('C', 'Tiga', '0'), opt('A', 'Satu', '1'), opt('D', 'Empat', '0'), opt('B', 'Dua', '0')]
    expect(plan(row({}, shuffled)).options.map((o) => `${o.position}${o.label}`)).toEqual(['1A', '2B', '3C', '4D'])
  })
})

describe('transformQuestion: images are held, never copied', () => {
  it('keeps the question image path as a structured list, holds the question inactive and counts', () => {
    const p = plan(row({ image_path: 'questions/q.png' }))
    expect(p.is_active).toBe(false)
    expect(p.import_issues).toEqual([{ code: 'legacy_image_unresolved', target: 'question', path: 'questions/q.png' }])
    expect(p.notes).toEqual(expect.arrayContaining(['question_image', 'held_image']))
    expect(plan(row({ image_path: '  ' })).is_active).toBe(true)
  })
})

describe('transformQuestion: HTML conversion, holds and entity decoding', () => {
  it('decodes entities (named and numeric) even when no tag is present, once only', () => {
    const p = plan(row({ body: 'A &amp; B &lt; C &#65; &#x42; &quot;D&quot; &amp;lt;' }))
    expect(p.stem).toBe('A & B < C A B "D" &lt;')
    expect(p.notes).toContain('entity_decoded')
  })

  it('holds a question whose text still has an image, maths or script markup after the conversion', () => {
    const img = plan(row({ body: 'Lihat <img src="a.png"> ini' }))
    expect(img.is_active).toBe(false)
    expect(img.import_issues).toEqual([{ code: 'html_image', target: 'stem' }])
    expect(img.notes).toContain('held_html_image')
    expect(plan(row({}, [opt('A', 'Satu', '0'), opt('B', '<math><mi>x</mi></math>', '1'), opt('C', 'Tiga', '0')])).import_issues).toEqual([{ code: 'html_math', target: 'option', label: 'B' }])
    for (const body of ['x <script>1</script>', 'klik <a href="x">sini</a>', '<td onclick="x()">a</td>', 'x <iframe src=y>', 'javascript:alert(1)', '&#60;script&#62;x']) {
      const p = plan(row({ body }))
      expect(p.is_active, body).toBe(false)
      expect(p.notes, body).toContain('held_html_residual')
    }
    const expl = plan(row({ explanation: 'lihat <svg></svg>' }))
    expect(expl.import_issues).toEqual([{ code: 'html_residual', target: 'explanation' }])
  })

  it('does not hold plain maths or prose with a bare < or "on...=" words', () => {
    for (const body of ['Jika x < y dan a<b, maka one = 1 dan ratio=2?', 'Hitung 3 < 5 > 2']) {
      const p = plan(row({ body }))
      expect(p.is_active, body).toBe(true)
      expect(p.import_issues).toBeNull()
    }
  })

  it('rejects a body (stem, option, explanation) over the length cap before any pattern runs', () => {
    const long = '<sup>'.repeat(10_000) + 'x'
    expect(rejected(row({ body: long }))).toBe('INVALID_VALUE:body')
    expect(rejected(row({}, [opt('A', long, '0'), opt('B', 'Dua', '1'), opt('C', 'Tiga', '0')]))).toBe('INVALID_VALUE:options.body')
    expect(rejected(row({ explanation: long }))).toBe('INVALID_VALUE:explanation')
  })
})

describe('transformQuestion: personal-data screen (count only)', () => {
  const kinds = (body: string) => plan(row({ body })).import_issues?.map((i) => `${i.target}:${i.kind}`)
  it('holds a question whose text looks like an IC number, phone, e-mail, URL or @handle, naming only the kind', () => {
    expect(kinds('IC 990101-14-5678 ialah')).toEqual(['stem:ic'])
    expect(kinds('Hubungi 012-3456789 atau +60123456789')).toEqual(['stem:phone'])
    expect(kinds('mel ke contoh@example.test')).toEqual(['stem:email'])
    expect(kinds('lawati https://example.test/x')).toEqual(['stem:url'])
    expect(kinds('lawati www.example.test')).toEqual(['stem:url'])
    expect(kinds('ikut @contoh_akaun di sini')).toEqual(['stem:handle'])
    const p = plan(row({ body: 'IC 990101145678', explanation: 'hubungi 0123456789' }))
    expect(p.is_active).toBe(false)
    expect(p.notes).toContain('held_pii_suspect')
    expect(JSON.stringify(p.import_issues)).not.toMatch(/990101|0123456789/)
  })

  it('checks options and explanation too, and leaves ordinary numbers alone', () => {
    const o = plan(row({}, [opt('A', 'a@b.test', '0'), opt('B', 'Dua', '1'), opt('C', 'Tiga', '0')]))
    expect(o.import_issues).toEqual([{ code: 'pii_suspect', target: 'option', label: 'A', kind: 'email' }])
    expect(plan(row({ explanation: 'lihat www.example.test' })).import_issues).toEqual([{ code: 'pii_suspect', target: 'explanation', kind: 'url' }])
    for (const body of ['Hitung 1234567 + 89 dan 3.14159 serta 2024-10-24', 'harga RM1,000,000 dan 12345']) {
      expect(plan(row({ body })).is_active, body).toBe(true)
    }
  })

  it('stays fast on a long text with many @ signs and digits (bounded patterns)', () => {
    const t0 = Date.now()
    const body = ('1234 a@' + 'b'.repeat(60) + ' ').repeat(200)
    plan(row({ body }))
    expect(Date.now() - t0).toBeLessThan(1000)
  })
})

describe('mapQuestionType', () => {
  it('maps mcq, objektif and pilihan_berganda case-insensitively and nothing else', () => {
    for (const t of ['mcq', 'MCQ', ' Mcq ', 'objektif', 'Objektif', 'pilihan_berganda', 'Pilihan Berganda']) expect(mapQuestionType(t), t).toBe('mcq')
    for (const t of ['subjective', 'esei', '', null]) expect(mapQuestionType(t as string | null), String(t)).not.toBe('mcq')
  })
})
