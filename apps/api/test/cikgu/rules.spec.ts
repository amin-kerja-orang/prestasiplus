import {
  CIKGU_RUBRICS,
  cikguCannedMarks,
  cikguCodePoints,
  cikguCsvCell,
  cikguMarkingReply,
  cikguSkorOf,
  cikguTierOf,
  cikguTokensIn,
  cikguTokensOut,
  cikguTpOf,
} from '@pp/contract'
import { describe, expect, it } from 'vitest'

import { activityMinutes, csvCell, dateLabelOf, parseHandoff, parseRphRequest, routeOf, rphContent, rubricOf, spOf } from '../../src/modules/cikgu/rules'
import { handoff } from './helpers'

const SUBJECTS = ['Matematik', 'Matematik Tambahan', 'Kimia', 'Sejarah', 'Bahasa Melayu']

describe('parseRphRequest caps (D9)', () => {
  it('cuts tajuk to 200 and the subject to 100 code points', () => {
    const p = parseRphRequest(`rph Matematik T4 ${'x'.repeat(300)}`, ['Matematik'])
    expect([...(p?.tajuk ?? '')]).toHaveLength(200)
    const s = parseRphRequest(`rph ${'S'.repeat(150)} T4 Bab`, ['S'.repeat(150)])
    expect([...(s?.subject ?? '')]).toHaveLength(100)
  })
})

describe('routing (BR-M13-04)', () => {
  it('picks the first match, case-insensitively', () => {
    expect(routeOf('Tolong mark karangan ini menggunakan rubric X')).toBe('mark_essay')
    expect(routeOf('  tolong MARK karangan ini menggunakan rubric X')).toBe('mark_essay')
    expect(routeOf('Jana rph untuk saya, minta latihan')).toBe('rph')
    expect(routeOf('Minta Latihan topik ini')).toBe('practice')
    expect(routeOf('ada soalan?')).toBe('practice')
    expect(routeOf('Terangkan konsep mol')).toBe('general')
    // "rph" inside a hand-off essay is still a hand-off: the prefix wins.
    expect(routeOf(handoff({ essay: 'rph latihan soalan' }))).toBe('mark_essay')
  })
})

describe('tiers and tokens (BR-M13-05/06)', () => {
  it('maps the role to tier and daily turns', () => {
    expect(cikguTierOf('admin')).toMatchObject({ tier: 'admin', dailyTurns: 100 })
    expect(cikguTierOf('teacher')).toMatchObject({ tier: 'guru', dailyTurns: 30 })
    for (const role of ['student', 'parent', 'sponsor', 'school_admin', 'ppd_officer', 'nobody']) expect(cikguTierOf(role)).toMatchObject({ tier: 'pelajar', dailyTurns: 10 })
  })

  it('counts code points', () => {
    expect(cikguTokensIn('abcd')).toBe(121)
    expect(cikguTokensIn('abcde')).toBe(122)
    expect(cikguCodePoints('🎤a')).toBe(2)
    expect(cikguTokensOut('')).toBe(0)
    expect(cikguTokensOut('a'.repeat(9))).toBe(3)
  })
})

describe('canned marks (BR-M13-09)', () => {
  it('is 70 % of the maximum for the six rubrics', () => {
    expect(CIKGU_RUBRICS.map((r) => [cikguCannedMarks(r.max), r.max])).toEqual([
      [35, 50],
      [35, 50],
      [21, 30],
      [21, 30],
      [14, 20],
      [70, 100],
    ])
    expect(cikguMarkingReply(CIKGU_RUBRICS[0]!, 35)).toContain('Markah: 35/50\nRubric: SPM Bahasa Melayu')
  })
})

describe('hand-off message (BR-M13-08)', () => {
  it('round trips through the parser, leaving out empty parts', () => {
    const essay = 'Membaca membuka minda dan menambah ilmu pengetahuan.'
    const m = handoff({ rubric: 'sejarah_essay', subject: ' Sejarah ', level: 'T5', student: '', title: 'Semangat. Patriotisme', essay: `${essay}\n\n${essay}` })
    expect(m.startsWith('Tolong mark karangan ini menggunakan rubric Sejarah — Karangan Esei (20 markah).')).toBe(true)
    expect(m).not.toContain('Pelajar:')
    const p = parseHandoff(m)
    expect(p.rubric.key).toBe('sejarah_essay')
    expect(p.subject).toBe('Sejarah')
    expect(p.level).toBe('T5')
    expect(p.student).toBeNull()
    expect(p.title).toBe('Semangat. Patriotisme')
    expect(p.essay).toBe(`${essay} ${essay}`)
  })

  it('falls back to the first rubric for an unknown label or key', () => {
    expect(parseHandoff('Tolong mark karangan ini menggunakan rubric Entah. Karangan: abc').rubric.key).toBe('spm_bm_karangan')
    expect(rubricOf('zzz').key).toBe('spm_bm_karangan')
    expect(rubricOf(null).key).toBe('spm_bm_karangan')
    expect(rubricOf('general').max).toBe(100)
  })
})

describe('RPH request (BR-M13-10)', () => {
  it('parses the SRS example', () => {
    expect(parseRphRequest('Tolong jana RPH untuk Matematik T4 Bab 3 esok', SUBJECTS)).toEqual({ subject: 'Matematik', level: 'T4', tajuk: 'Bab 3', tomorrow: true })
  })

  it('takes the longest subject, word levels and "hari ini"', () => {
    expect(parseRphRequest('jana rph Matematik Tambahan Tingkatan 5 Fungsi hari ini', SUBJECTS)).toMatchObject({ subject: 'Matematik Tambahan', level: 'T5', tajuk: 'Fungsi', tomorrow: false })
    expect(parseRphRequest('rph Kimia Darjah 6', SUBJECTS)).toMatchObject({ level: 'D6' })
  })

  it('defaults the tajuk and refuses a missing subject or level', () => {
    expect(parseRphRequest('rph Kimia T5', SUBJECTS)?.tajuk).toBe('Kimia Tingkatan 5')
    expect(parseRphRequest('rph Fizik T5', SUBJECTS)).toBeNull()
    expect(parseRphRequest('rph Kimia', SUBJECTS)).toBeNull()
    expect(parseRphRequest('rph Kimia T6', SUBJECTS)).toBeNull()
  })
})

describe('RPH content (BR-M13-11)', () => {
  it('splits 60 minutes as 6/15/15/15/9 and keeps the section order', () => {
    expect(activityMinutes(60)).toEqual([6, 15, 15, 15, 9])
    expect(activityMinutes(45).reduce((a, b) => a + b, 0)).toBe(45)
    expect(activityMinutes(90)).toEqual([9, 22, 22, 23, 14])
    const c = rphContent({ subjectName: 'Kimia', level: 'T5', tajuk: 'Elektrolisis', className: null, dateLabel: '28/09/2026', durationMinutes: 60, timeSlot: null, tema: null, pengajaranKeperluan: 'Projektor' })
    const order = ['Standard Kandungan', 'Standard Pembelajaran', 'Objektif Pembelajaran', 'Aktiviti PdPc', 'BBM', 'EMK', 'PBD Assessment plan', 'Keperluan Khas: Projektor']
    const at = order.map((s) => c.indexOf(s))
    expect(at.every((n) => n >= 0)).toBe(true)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    expect(c).toContain('Set Induksi (6 minit)')
    expect(c).not.toContain('Kelas:')
    expect(c.endsWith('Keperluan Khas: Projektor')).toBe(true)
  })

  it('formats dates as dd/mm/yyyy', () => {
    expect(dateLabelOf('2026-09-05')).toBe('05/09/2026')
  })
})

describe('PBD maths and SP labels (BR-M13-14/15)', () => {
  it('bands the score and rounds to one decimal', () => {
    expect([0, 19.9, 20, 39.9, 40, 59.9, 60, 74.9, 75, 89.9, 90, 100].map(cikguTpOf)).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6])
    expect(cikguSkorOf(8, 9)).toBe(88.9)
    expect(cikguSkorOf(2, 9)).toBe(22.2)
    expect(cikguSkorOf(3, 8)).toBe(37.5)
  })

  it('Kimia is 5.1.1; Sejarah and every other subject 1.1.1', () => {
    expect([spOf('Kimia'), spOf('Sejarah'), spOf('Matematik'), spOf('')]).toEqual(['5.1.1', '1.1.1', '1.1.1', '1.1.1'])
  })
})

describe('PBD CSV cell (SEC-M13-04)', () => {
  it.each(['=', '+', '-', '@'])('prefixes a quote when a cell starts with %s', (lead) => {
    expect(csvCell(`${lead}1+1`)).toBe(`'${lead}1+1`)
    expect(csvCell(`${lead}1+1`)).toBe(cikguCsvCell(`${lead}1+1`))
  })

  it('also guards a leading tab or carriage return (stricter than the mock)', () => {
    expect(csvCell('\tx')).toBe("'\tx")
    expect(csvCell('\rx')).toBe('"\'\rx"')
  })

  it('neutralises a formula name and still quotes commas and quotes', () => {
    expect(csvCell('=HYPERLINK("http://x.test","Klik")')).toBe(`"'=HYPERLINK(""http://x.test"",""Klik"")"`)
    expect(csvCell('a,b')).toBe('"a,b"')
    expect(csvCell('a\nb')).toBe('"a\nb"')
  })

  it('leaves ordinary cells and numbers alone', () => {
    expect(csvCell('Aina binti Ali')).toBe('Aina binti Ali')
    expect(csvCell('5.1.1')).toBe('5.1.1')
    expect(csvCell(3)).toBe('3')
    expect(csvCell('a=b')).toBe('a=b')
    expect(csvCell('')).toBe('')
  })
})
