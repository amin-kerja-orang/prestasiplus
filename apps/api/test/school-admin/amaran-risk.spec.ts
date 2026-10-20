import { describe, expect, it } from 'vitest'

import { amaranCsv } from '../../src/modules/school-admin/amaran/amaran.csv'
import {
  classLabelOf,
  computeRisk,
  DAY_MS,
  effectivenessOf,
  effectivenessReport,
  inTingkatan,
  levelLabelOf,
  masteryLevelOf,
  parseTingkatan,
  pupilView,
  rankOrder,
  scorePupils,
  statusOf,
  tallyOf,
  trendMonths,
  weaknessOf,
  yyyymmdd,
  type PupilFacts,
} from '../../src/modules/school-admin/amaran/risk.rules'

const NOW = Date.parse('2026-10-21T10:00:00+08:00')

const facts = (over: Partial<PupilFacts> = {}): PupilFacts => ({
  userId: '1',
  name: 'Murid Satu',
  grade: 10,
  classes: [{ name: 'Amanah', slug: 'tingkatan-4' }],
  accuracy: null,
  sessions: 0,
  lastActiveAt: null,
  masteryLevels: [],
  ...over,
})

const scored = (over: Partial<PupilFacts> = {}) => scorePupils([facts(over)], NOW)[0]!

describe('BE-21 Amaran risk formula (AC 10)', () => {
  it('uses A = 100 - accuracy, E = days x 100 / 30, M = (10 - mean level) x 10 and score = 0.4A + 0.3E + 0.3M', () => {
    const r = computeRisk({ accuracy: 80, sessions: 4, lastActiveAt: NOW - 15 * DAY_MS, masteryLevels: [4, 6] }, NOW)
    expect(r.a).toBe(20)
    expect(r.e).toBe(50)
    expect(r.m).toBe(50)
    expect(r.score).toBe(38) // 8 + 15 + 15
    expect(r.status).toBe('on_track')
    expect(r.neverActive).toBe(false)
    expect(r.masteryMean).toBe(5)
  })

  it('counts whole days only (floor) and caps E at 100', () => {
    expect(computeRisk({ accuracy: 100, sessions: 1, lastActiveAt: NOW - (3 * DAY_MS + DAY_MS - 1), masteryLevels: [10] }, NOW).e).toBe(10)
    expect(computeRisk({ accuracy: 100, sessions: 1, lastActiveAt: NOW - 90 * DAY_MS, masteryLevels: [10] }, NOW).e).toBe(100)
    expect(computeRisk({ accuracy: 100, sessions: 1, lastActiveAt: NOW + DAY_MS, masteryLevels: [10] }, NOW).e).toBe(0)
  })

  it('rounds the score to one decimal', () => {
    const r = computeRisk({ accuracy: 66.6, sessions: 3, lastActiveAt: NOW - 7 * DAY_MS, masteryLevels: [3] }, NOW)
    // A 33.4 -> 13.36, E 23.33 -> 7, M 70 -> 21 : 41.36
    expect(r.score).toBe(41.4)
  })

  it('A is 100 without a session but with a last-active date or a mastery record', () => {
    expect(computeRisk({ accuracy: null, sessions: 0, lastActiveAt: NOW, masteryLevels: [] }, NOW).a).toBe(100)
    expect(computeRisk({ accuracy: null, sessions: 0, lastActiveAt: null, masteryLevels: [5] }, NOW).a).toBe(100)
  })

  it('a pupil with no session, no activity and no mastery is never active: A 50, E 100, M 100, score 80', () => {
    const r = computeRisk({ accuracy: null, sessions: 0, lastActiveAt: null, masteryLevels: [] }, NOW)
    expect([r.a, r.e, r.m, r.score, r.status, r.neverActive]).toEqual([50, 100, 100, 80, 'high', true])
  })

  it('M is 100 without mastery records', () => {
    expect(computeRisk({ accuracy: 90, sessions: 2, lastActiveAt: NOW, masteryLevels: [] }, NOW).m).toBe(100)
  })

  it('status bands: below 40 on_track, below 60 watch, otherwise high', () => {
    expect([39.9, 40, 59.9, 60, 100, 0].map(statusOf)).toEqual(['on_track', 'watch', 'watch', 'high', 'high', 'on_track'])
  })
})

describe('BE-21 Amaran mastery level from the M05 ladder', () => {
  it('maps the correct answers of a subject to a level 0 to 10 with the owner thresholds', () => {
    expect([0, 9, 10, 24, 25, 100, 1099, 1100, 1500, 99999].map(masteryLevelOf)).toEqual([0, 0, 1, 1, 2, 4, 8, 9, 10, 10])
  })
})

describe('BE-21 Amaran cell texts and labels', () => {
  it('uses the exact BM strings', () => {
    const active = pupilView(scored({ accuracy: 72.46, sessions: 2, lastActiveAt: NOW - DAY_MS, masteryLevels: [3, 4] }), 1)
    expect(active.accuracyText).toBe('Purata ketepatan: 72.5%')
    expect(active.engagementText).toBe('Terakhir aktif: 2026-10-20')
    expect(active.masteryText).toBe('Purata tahap: L4')
    expect(active.mastery).toBe(3.5)
    expect(active.className).toBe('Amanah')
    expect(active.classLabel).toBe('Tingkatan 4 Amanah')
    expect(active.levelLabel).toBe('Tingkatan 4')
    expect(active.tingkatan).toBe(4)
  })

  it('never-active pupils get the no-data family; a pupil with a date but no sessions gets "Tiada data"', () => {
    const never = pupilView(scored({ classes: [], grade: null }), 1)
    expect([never.accuracyText, never.engagementText, never.masteryText, never.classLabel, never.levelLabel]).toEqual([
      'Tiada data latihan',
      'Tiada aktiviti',
      'Tiada data penguasaan',
      '-',
      null,
    ])
    const seen = pupilView(scored({ lastActiveAt: NOW }), 1)
    expect([seen.accuracyText, seen.masteryText]).toEqual(['Tiada data', 'Tiada data'])
  })

  it('level and class labels', () => {
    expect([levelLabelOf(3), levelLabelOf(7), levelLabelOf(11), levelLabelOf(0), levelLabelOf(null)]).toEqual(['Darjah 3', 'Tingkatan 1', 'Tingkatan 5', null, null])
    expect(classLabelOf([{ name: 'Bestari', slug: 'tahun-5' }])).toBe('Darjah 5 Bestari')
    expect(classLabelOf([{ name: 'Bestari', slug: null }])).toBe('Bestari')
  })

  it('tingkatan filter accepts T4, T5, 4, 5 in any case; anything else is no filter', () => {
    expect(['T4', 't4', '4', ' T5 ', '5', 'T6', '', 'x', undefined].map((v) => parseTingkatan(v))).toEqual([4, 4, 4, 5, 5, undefined, undefined, undefined, undefined])
    expect(inTingkatan([{ name: 'A', slug: 'tingkatan-4' }], 4)).toBe(true)
    expect(inTingkatan([{ name: 'A', slug: 'tingkatan-4' }], 5)).toBe(false)
    expect(inTingkatan([], 4)).toBe(false)
  })

  it('ranks by score descending, then name, then id, and tallies with integer percentages', () => {
    const list = scorePupils(
      [
        facts({ userId: '3', name: 'Cili', accuracy: 95, sessions: 5, lastActiveAt: NOW, masteryLevels: [9] }),
        facts({ userId: '1', name: 'Anggur' }),
        facts({ userId: '2', name: 'Betik' }),
      ],
      NOW,
    ).sort(rankOrder)
    expect(list.map((p) => p.facts.name)).toEqual(['Anggur', 'Betik', 'Cili'])
    expect(tallyOf(list)).toEqual({ green: 1, yellow: 0, red: 2, total: 3, pct: { green: 33, yellow: 0, red: 67 } })
    expect(tallyOf([]).pct).toEqual({ green: 0, yellow: 0, red: 0 })
  })

  it('yyyymmdd is the Malaysia date', () => {
    expect(yyyymmdd(Date.parse('2026-10-20T17:00:00Z'))).toBe('20261021')
    expect(yyyymmdd(Date.parse('2026-10-20T15:59:00Z'))).toBe('20261020')
  })
})

describe('BE-21 Amaran weakness and the k=5 cohort rule', () => {
  it('counts weak pupils (under 50 percent correct) per subject and leaves out a subject answered by fewer than 5 pupils', () => {
    const pupil = (sub: string, correct: number, answered: number) => [{ subjectId: sub, correct, answered }]
    const rows = weaknessOf(
      [pupil('10', 1, 10), pupil('10', 9, 10), pupil('10', 5, 10), pupil('10', 0, 4), pupil('10', 4, 4), pupil('2', 0, 5), pupil('2', 0, 5), [{ subjectId: '10', correct: 0, answered: 0 }]],
      5,
    )
    expect(rows).toEqual([{ subjectId: '10', weak: 2, total: 5, pct: 40 }])
  })

  it('orders subjects by numeric id', () => {
    const p = [
      { subjectId: '9', correct: 0, answered: 1 },
      { subjectId: '10', correct: 0, answered: 1 },
    ]
    expect(weaknessOf([p, p, p, p, p], 5).map((r) => r.subjectId)).toEqual(['9', '10'])
  })
})

describe('BE-21 Amaran effectiveness report', () => {
  const school = { id: '7', name: 'SMK Contoh' }
  const row = (id: string, date: string, before: number | null, after: number | null, teacherId = '50') => ({
    id,
    studentId: `9${id}`,
    studentName: `Murid ${id}`,
    teacherId,
    date,
    beforeAccuracy: before,
    afterAccuracy: after,
  })

  it('judges effectiveness from the before and after accuracy', () => {
    const e = (beforeAccuracy: number | null, afterAccuracy: number | null) => effectivenessOf({ beforeAccuracy, afterAccuracy })
    expect([e(40, 60), e(60, 40), e(50, 50), e(50, null), e(null, 50)]).toEqual(['berkesan', 'tidak_berkesan', 'sederhana', 'belum_dinilai', 'belum_dinilai'])
  })

  it('builds cards, doughnut, trend (6 BM months), follow-ups and the teacher rate', () => {
    const rep = effectivenessReport(
      [row('1', '2026-10-05', 40, 70), row('2', '2026-10-06', 70, 40), row('3', '2026-09-30', 50, 50), row('4', '2026-05-01', 50, null), row('5', '2026-04-30', 10, 90, '51')],
      NOW,
      school,
      new Map([['50', 'Cikgu Contoh']]),
    )
    expect(rep.cards).toEqual({ total: 5, berkesan: 2, evaluated: 4, rate: 50, needsAction: 2, sederhana: 1, tidakBerkesan: 1, notEvaluated: 1 })
    expect(rep.doughnut).toEqual([2, 1, 1, 1])
    expect(rep.trend.labels).toEqual(['Mei 2026', 'Jun 2026', 'Jul 2026', 'Ogo 2026', 'Sep 2026', 'Okt 2026'])
    expect(rep.trend.data).toEqual([1, 0, 0, 0, 1, 2])
    expect(rep.byType).toEqual([{ type: 'lain', label: 'Lain-lain', count: 5 }])
    expect(rep.byTeacher[0]).toEqual({ teacherId: '50', name: 'Cikgu Contoh', total: 4, berkesan: 1, notEvaluated: 1, rate: 33 })
    expect(rep.byTeacher[1]?.name).toBe('Guru 51')
    expect(rep.followUps.map((f) => f.id)).toEqual(['2', '3', '4'])
    expect(rep.bySchool).toEqual([{ schoolId: '7', school: 'SMK Contoh', total: 5, berkesan: 2, sederhana: 1, tidakBerkesan: 1, notEvaluated: 1, rate: 50 }])
  })

  it('an empty log gives the zero state', () => {
    const rep = effectivenessReport([], NOW, school, new Map())
    expect(rep.cards.rate).toBe(0)
    expect(rep.doughnut).toEqual([0, 0, 0, 0])
    expect(rep.trend.data).toEqual([0, 0, 0, 0, 0, 0])
    expect(rep.byTeacher).toEqual([])
    expect(rep.bySchool).toEqual([])
  })

  it('the trend crosses a year boundary in Malaysia time', () => {
    expect(trendMonths(Date.parse('2026-12-31T20:00:00Z')).labels).toEqual(['Ogo 2026', 'Sep 2026', 'Okt 2026', 'Nov 2026', 'Dis 2026', 'Jan 2027'])
  })
})

describe('BE-21 Amaran CSV (pure part)', () => {
  const pupils = scorePupils(
    [
      facts({ userId: '1', name: '=HYPERLINK("http://evil.test","klik")' }),
      facts({ userId: '2', name: 'Murid, "Koma"', classes: [] }),
      facts({ userId: '3', name: '@SUM(A1)', accuracy: 80, sessions: 1, lastActiveAt: NOW, masteryLevels: [5] }),
    ],
    NOW,
  )
    .sort(rankOrder)
    .map((p, i) => pupilView(p, i + 1))

  it('has a BOM, CRLF line ends with a trailing CRLF and the contract header', () => {
    const csv = amaranCsv(pupils)
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv.endsWith('\r\n')).toBe(true)
    expect(csv.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/)
    expect(csv.slice(1).split('\r\n')[0]).toBe('Bil,Pelajar,Tingkatan / Kelas,Skor Risiko,Status,Ketepatan,Penglibatan,Penguasaan')
    expect(csv.split('\r\n')).toHaveLength(pupils.length + 2)
  })

  it('neutralises formula cells with an apostrophe and quotes commas and quotes', () => {
    const csv = amaranCsv(pupils)
    expect(csv).toContain(`"'=HYPERLINK(""http://evil.test"",""klik"")"`)
    expect(csv).toContain(`'@SUM(A1)`)
    expect(csv).toContain(`"Murid, ""Koma"""`)
  })

  it('has no IC, e-mail or phone field on the row', () => {
    for (const k of Object.keys(pupils[0]!)) expect(k).not.toMatch(/^(email|phone|ic.*)$/i)
  })
})
