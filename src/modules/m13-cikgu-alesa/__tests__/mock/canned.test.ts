/**
 * Pure rules of M13 (SRS M13 v1.1 BR-M13-04…11, BR-M13-14; §8.2): routing, tokens, hand-off round
 * trip, RPH request parsing, activity split, TP bands.
 */

import { describe, expect, it } from 'vitest'

import { buildHandoffMessage, RUBRICS } from '../../api/settings'
import {
  activityMinutes,
  cannedMarks,
  countChars,
  markingReply,
  parseHandoff,
  parseRphRequest,
  routeOf,
  rphContent,
  skorOf,
  tokensIn,
  tokensOut,
  tpOf,
} from '../../mock/repository/canned'
import { dummyEssay } from '../../mock/seeds/seed'

const SUBJECTS = ['Matematik', 'Matematik Tambahan', 'Kimia', 'Sejarah', 'Bahasa Melayu']

describe('routing (BR-M13-04)', () => {
  it('picks the first match, case-insensitively', () => {
    expect(routeOf('Tolong mark karangan ini menggunakan rubric X')).toBe('mark_essay')
    expect(routeOf('  tolong MARK karangan ini menggunakan rubric X')).toBe('mark_essay')
    expect(routeOf('Jana rph untuk saya, minta latihan')).toBe('rph')
    expect(routeOf('Minta Latihan topik ini')).toBe('practice')
    expect(routeOf('ada soalan?')).toBe('practice')
    expect(routeOf('Terangkan konsep mol')).toBe('general')
  })
})

describe('tokens (BR-M13-05)', () => {
  it('counts code points', () => {
    expect(tokensIn('abcd')).toBe(121)
    expect(tokensIn('abcde')).toBe(122)
    expect(countChars('🎤a')).toBe(2)
    expect(tokensOut('')).toBe(0)
    expect(tokensOut('a'.repeat(9))).toBe(3)
  })
})

describe('canned marks (BR-M13-09)', () => {
  it('is 70 % of the maximum for the six rubrics', () => {
    expect(RUBRICS.map((r) => [cannedMarks(r.max), r.max])).toEqual([
      [35, 50],
      [35, 50],
      [21, 30],
      [21, 30],
      [14, 20],
      [70, 100],
    ])
    expect(markingReply(RUBRICS[0]!, 35)).toContain('Markah: 35/50\nRubric: SPM Bahasa Melayu')
  })
})

describe('hand-off message (BR-M13-08)', () => {
  it('round trips through the parser, leaving out empty parts', () => {
    const essay = dummyEssay(120)
    const m = buildHandoffMessage({
      rubric: 'sejarah_essay',
      subject: ' Sejarah ',
      level: 'T5',
      student: '',
      title: 'Semangat. Patriotisme',
      essay: `${essay}\n\n${essay}`,
    })
    expect(
      m.startsWith(
        'Tolong mark karangan ini menggunakan rubric Sejarah — Karangan Esei (20 markah).',
      ),
    ).toBe(true)
    expect(m).not.toContain('Pelajar:')
    expect(m).not.toContain('\n')
    const p = parseHandoff(m)
    expect(p.rubric.key).toBe('sejarah_essay')
    expect(p.subject).toBe('Sejarah')
    expect(p.level).toBe('T5')
    expect(p.student).toBeNull()
    expect(p.title).toBe('Semangat. Patriotisme')
    expect(p.essay).toBe(`${essay} ${essay}`)
  })

  it('falls back to the first rubric for an unknown key', () => {
    expect(buildHandoffMessage({ rubric: 'nope', essay: 'x' })).toContain(
      'rubric SPM Bahasa Melayu',
    )
    expect(parseHandoff(buildHandoffMessage({ rubric: 'zzz', essay: 'abc' })).rubric.key).toBe(
      'spm_bm_karangan',
    )
  })
})

describe('RPH request (BR-M13-10)', () => {
  it('parses the SRS example', () => {
    expect(parseRphRequest('Tolong jana RPH untuk Matematik T4 Bab 3 esok', SUBJECTS)).toEqual({
      subject: 'Matematik',
      level: 'T4',
      tajuk: 'Bab 3',
      tomorrow: true,
    })
  })

  it('takes the longest subject, word levels, and "hari ini"', () => {
    const p = parseRphRequest('jana rph Matematik Tambahan Tingkatan 5 Fungsi hari ini', SUBJECTS)
    expect(p).toMatchObject({
      subject: 'Matematik Tambahan',
      level: 'T5',
      tajuk: 'Fungsi',
      tomorrow: false,
    })
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
    const c = rphContent({
      subjectName: 'Kimia',
      level: 'T5',
      tajuk: 'Elektrolisis',
      className: null,
      dateLabel: '28/09/2026',
      durationMinutes: 60,
      timeSlot: null,
      tema: null,
      pengajaranKeperluan: 'Projektor',
    })
    const order = [
      'Standard Kandungan',
      'Standard Pembelajaran',
      'Objektif Pembelajaran',
      'Aktiviti PdPc',
      'BBM',
      'EMK',
      'PBD Assessment plan',
      'Keperluan Khas: Projektor',
    ]
    const at = order.map((s) => c.indexOf(s))
    expect(at.every((n) => n >= 0)).toBe(true)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    expect(c).toContain('Set Induksi (6 minit)')
    expect(c).not.toContain('Kelas:')
  })
})

describe('PBD (BR-M13-14)', () => {
  it('bands the score and rounds to one decimal', () => {
    expect([0, 19.9, 20, 39.9, 40, 59.9, 60, 74.9, 75, 89.9, 90, 100].map(tpOf)).toEqual([
      1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6,
    ])
    expect(skorOf(8, 9)).toBe(88.9)
    expect(skorOf(2, 9)).toBe(22.2)
    expect(skorOf(3, 8)).toBe(37.5)
  })
})
