/**
 * M10-T3: the Command Center handlers (SRS M10 v1.18 §7 #2–#10) over the real stores of M01–M05,
 * M08, M10, M12, M14 and M17 at the project clock (2026-09-25 15:40 MYT). Tests run in order and
 * share one runtime; the remedial writes come last.
 */

import { beforeAll, describe, expect, it } from 'vitest'

import type { HttpMethod } from '@/api/transport'
import { CLOCK_ANCHOR_ISO, createClock } from '@/lib/time'
import { setUser } from '@/mock/core-data/set-user'
import { bootMock, type MockRuntime } from '@/mock/index'
import m01 from '@/modules/m01-authentication/mock'
import m02 from '@/modules/m02-users-schools/mock'
import m03 from '@/modules/m03-curriculum/mock'
import m04, { questions } from '@/modules/m04-question-bank/mock'
import m05, { practice } from '@/modules/m05-practice/mock'
import m08 from '@/modules/m08-student-performance/mock'
import m12 from '@/modules/m12-kirkpatrick/mock'
import m14 from '@/modules/m14-gamification/mock'
import m17 from '@/modules/m17-admin-dashboard/mock'

import type {
  CcAchievements,
  CcBadgeHolders,
  CcDrill,
  CcEvaluation,
  CcLiveData,
  CcPredictive,
  CcRemedialScan,
} from '../../api/command-center-types'
import m10, { remedialTests } from '../../mock'
import {
  drillGradeOfGps,
  engagementBand,
  evaluationRisk,
  gradeOfPercent,
  predictionRisk,
  rarityOfHolders,
  trendLabel,
  weekChange,
} from '../../mock/handlers/command-center-rules'

const ADMIN = 1
const PELAJAR = 2
const GURU = 5
const BASE = '/api/guru/command-center'

let runtime: MockRuntime

beforeAll(async () => {
  runtime = await bootMock({
    mode: 'test',
    plugins: [m01, m02, m03, m04, m05, m08, m10, m12, m14, m17],
    clock: createClock({ at: CLOCK_ANCHOR_ISO }),
    latencyMs: 0,
    onWarn: null,
  })
}, 300_000)

async function call<T = unknown>(
  as: number | null,
  url: string,
  method: HttpMethod = 'GET',
  body?: unknown,
): Promise<{ status: number; body: T }> {
  const headers: Record<string, string> = { accept: 'application/json' }
  if (as !== null) headers.authorization = `Bearer ${setUser(as).token}`
  if (body !== undefined) headers['content-type'] = 'application/json'
  const res = await runtime.transport.request({
    method,
    url,
    headers,
    ...(body !== undefined ? { body } : {}),
  })
  return { status: res.status, body: res.body as T }
}

interface Err {
  error: { code: string; message: string }
}

describe('guards (T) and own scope', () => {
  const urls = [
    `${BASE}/live-data`,
    `${BASE}/drill?type=students`,
    `${BASE}/remedial/scan`,
    `${BASE}/predictive`,
    `${BASE}/evaluate`,
    `${BASE}/achievements`,
    `${BASE}/badge-holders?badgeId=1`,
  ]

  it('answers a guest 401 and a student 403 on every read', async () => {
    for (const url of urls) {
      expect((await call(null, url)).status).toBe(401)
      const r = await call<Err>(PELAJAR, url)
      expect(r.status).toBe(403)
      expect(r.body.error.code).toBe('FORBIDDEN')
    }
  })

  it('refuses the writes to a guest and a student', async () => {
    for (const as of [null, PELAJAR]) {
      for (const path of ['generate', 'cancel']) {
        const r = await call(as, `${BASE}/remedial/${path}`, 'POST', {
          studentId: 3001,
          subject: 'Kimia',
          quizId: 7601,
        })
        expect(r.status).toBe(as === null ? 401 : 403)
      }
    }
  })
})

describe('#2 live-data', () => {
  it('reproduces the S2 anchors of account 5 (8 pupils, 0 active today, 83 answers)', async () => {
    const r = await call<CcLiveData>(GURU, `${BASE}/live-data`)
    expect(r.status).toBe(200)
    const d = r.body
    expect(d.teacherName).toBe('Guru Demo')
    expect([d.totalStudents, d.totalStudentsRaw]).toEqual(['8', 8])
    expect([d.activeStudents, d.activeStudentsRaw]).toEqual(['0', 0])
    expect([d.totalAnswered, d.totalAnsweredRaw]).toEqual(['83', 83])
    expect(d.answeredTodayRaw).toBe(0)
    // 7 days ending 25 Sep: 22 Sep (32) + 24 Sep (4); previous 7 days: 15 Sep (32) + 18 Sep (15)
    expect(d.answeredWeekRaw).toBe(36)
    expect(d.weekChange).toBe(-23)
    expect(d.accuracy).toBe(46)
    expect(d.classes.map((c) => [c.id, c.studentCount, c.educationLevel])).toEqual([
      [2001, 8, 'tingkatan-5'],
      [2002, 8, 'tingkatan-5'],
    ])
    expect(d.engagement).toEqual({
      champion: 0,
      consistent: 0,
      developing: 6,
      minimum: 2,
      disengaged: 0,
    })
    expect(d.recentFeed).toHaveLength(10)
    expect(d.leaderboardWeek[0]?.studentId).toBe(3007)
    expect(d.mood).toEqual({ happy: 0, okay: 0, sad: 0, stressed: 0 })
    expect(d.generatedAt).toBe('2026-09-25T15:40:00+08:00')
    expect(d.kirkT4Gps).toBe(d.gpsOverall ?? 0)
  })

  it('reproduces the admin mirror: no pupil, GPS 4.69 (BR-M10-08)', async () => {
    const d = (await call<CcLiveData>(ADMIN, `${BASE}/live-data`)).body
    expect([d.totalStudentsRaw, d.activeStudentsRaw, d.totalAnsweredRaw, d.accuracy]).toEqual([
      0, 0, 0, 0,
    ])
    expect(d.gpsOverall).toBe(4.69)
    expect(d.classes).toEqual([])
    expect(d.kirkT4Gps).toBe(4.69)
  })

  it('scopes to the own pupils: teachers 442, 1699 and 4186 (F-30 cards 0 / 76 / 89)', async () => {
    const counts: number[] = []
    for (const id of [442, 1699, 4186]) {
      counts.push((await call<CcLiveData>(id, `${BASE}/live-data`)).body.totalStudentsRaw)
    }
    expect(counts).toEqual([0, 76, 89])
  })
})

describe('#3 drill (DV-M10-04 titles)', () => {
  const drill = (q: string, as = GURU) => call<CcDrill & Err>(as, `${BASE}/drill?${q}`)

  it('titles every drill with the label of the tile or panel', async () => {
    const titles: Record<string, string> = {
      'type=students': 'Pelajar Berdaftar',
      'type=today': 'Soalan Dijawab',
      'type=today&filter=aktiviti': 'Aktiviti Hari Ini',
      'type=subjects': 'Ketepatan Purata',
      'type=gps': 'GPS Sekolah',
      'type=kirk&filter=t1': 'Kirkpatrick T1',
      'type=kirk&filter=t2': 'Kirkpatrick T2',
      'type=kirk&filter=t3': 'Kirkpatrick T3',
      'type=kirk&filter=t4': 'Kirkpatrick T4',
      'type=mood': 'Mood Pelajar',
      'type=engagement': 'Penglibatan Pelajar',
    }
    for (const [q, title] of Object.entries(titles)) {
      const r = await drill(q)
      expect(r.status, q).toBe(200)
      expect(r.body.title, q).toBe(title)
    }
  })

  it('lists the students, subjects and the engagement bands of account 5', async () => {
    const students = (await drill('type=students')).body.students as {
      studentId: number
      status: string
    }[]
    expect(students).toHaveLength(8)
    expect(students.every((s) => s.status === 'Login')).toBe(true)
    expect((await drill('type=students&filter=active')).body.students).toEqual([])
    expect((await drill('type=today')).body.students).toEqual([])
    const subjects = (await drill('type=subjects')).body.students as {
      subject: string
      answered: number
    }[]
    expect(subjects.map((s) => [s.subject, s.answered])).toEqual([
      ['Kimia', 68],
      ['Sejarah', 15],
    ])
    expect((await drill('type=engagement&filter=developing')).body.students).toHaveLength(6)
    expect((await drill('type=engagement&filter=minimum')).body.students).toHaveLength(2)
  })

  it('gives the vs cards for kirk t2 to t4 and no rows', async () => {
    const r = (await drill('type=kirk&filter=t2')).body
    expect(r.students).toEqual([])
    expect(r.vsLabel).toBe('Bulan Ini vs Bulan Lepas')
    expect(r.extra).toMatchObject({
      answersNow: 83,
      answersPrev: 0,
      activeNow: 8,
      newStudents: 8,
      accuracyNow: 46,
    })
  })

  it('is empty ("Tiada data") for the admin, as observed', async () => {
    for (const q of [
      'type=students',
      'type=today',
      'type=gps',
      'type=mood',
      'type=kirk&filter=t1',
    ]) {
      expect((await drill(q, ADMIN)).body.students, q).toEqual([])
    }
  })

  it('answers 422 for an unknown type or filter', async () => {
    const bad = [
      '',
      'type=nope',
      'type=kirk',
      'type=kirk&filter=t9',
      'type=mood&filter=angry',
      'type=engagement&filter=x',
    ]
    for (const q of bad) {
      const r = await drill(q)
      expect(r.status, q).toBe(422)
      expect(r.body.error.code).toBe('VALIDATION_ERROR')
    }
  })
})

describe('#4 remedial scan', () => {
  it('lists the weak Kimia topics (M08 fixtures 9001-9004) and the open test 7601', async () => {
    const r = await call<CcRemedialScan>(GURU, `${BASE}/remedial/scan`)
    expect(r.status).toBe(200)
    expect(r.body.weakStudents.map((w) => w.studentId)).toEqual([
      3002, 3003, 3004, 3005, 3006, 3007, 3008,
    ])
    const topics = new Set(r.body.weakStudents.flatMap((w) => w.weakTopics.map((t) => t.topicName)))
    expect([...topics].sort()).toEqual([
      'Getah Asli',
      'Polimer',
      'Sel Elektrolisis',
      'Siri Homolog',
    ])
    for (const w of r.body.weakStudents) {
      expect(w.weakestAccuracy).toBe(w.weakTopics[0]?.accuracy)
      expect(w.weakTopics.every((t) => t.accuracy < 50 && t.subject === 'Kimia')).toBe(true)
    }
    // active 7601 and completed 7602 (FN-M10-2.2.11 "Selesai (60%)"), newest first
    expect(r.body.existingRemedials).toEqual([
      { id: 7601, studentId: 3008, status: 'active', totalQuestions: 5, afterAccuracy: null },
      { id: 7602, studentId: 3007, status: 'completed', totalQuestions: 5, afterAccuracy: 60 },
    ])
  })

  it('is empty for the admin', async () => {
    const r = await call<CcRemedialScan>(ADMIN, `${BASE}/remedial/scan`)
    expect(r.body).toEqual({ weakStudents: [], existingRemedials: [] })
  })
})

describe('#7 predictive and #8 evaluate', () => {
  it('predicts the three pupils with 10 or more answers (BR-M10-14)', async () => {
    const p = (await call<CcPredictive>(GURU, `${BASE}/predictive`)).body
    expect(
      p.predictions.map((x) => [
        x.studentId,
        x.overallAccuracy,
        x.predictedGrade,
        x.predictedGps,
        x.risk,
      ]),
    ).toEqual([
      [3003, 38, 'G', 9, 'kritikal'],
      [3002, 53, 'C', 6, 'sederhana'],
      [3001, 86, 'A', 1, 'rendah'],
    ])
    expect(p.totalPredicted).toBe(3)
    expect(p.atRiskCount).toBe(1)
    expect(p.avgPredictedGps).toBe(5.33)
    expect(Object.keys(p.gradeDistribution)).toHaveLength(10)
    expect(p.gradeDistribution.G).toBe(1)
  })

  it('evaluates the alerts of BR-M10-15 and is read-only', async () => {
    const before = remedialTests.forStudent(3008).length
    const e = (await call<CcEvaluation>(GURU, `${BASE}/evaluate`)).body
    expect(e.summary).toEqual({ totalStudents: 8, atRisk: 6, critical: 0, high: 2, medium: 4 })
    const s3003 = e.alerts.find((a) => a.studentId === 3003)
    expect(s3003?.riskLevel).toBe('high')
    expect(s3003?.alerts.map((a) => a.message)).toEqual([
      'Tiada aktiviti 7 hari',
      'Ketepatan rendah (38%)',
    ])
    expect(remedialTests.forStudent(3008).length).toBe(before)
    expect((await call<CcPredictive>(ADMIN, `${BASE}/predictive`)).body.totalPredicted).toBe(0)
    expect((await call<CcEvaluation>(ADMIN, `${BASE}/evaluate`)).body.alerts).toEqual([])
  })
})

describe('#8 evaluate: a pupil who never answered is inactive (BR-M10-15)', () => {
  it('alerts "Tiada aktiviti" with at least 7 days for enrolled pupils without an answer', async () => {
    let found = 0
    for (const teacher of [1699, 4186]) {
      const drill = await call<CcDrill>(teacher, `${BASE}/drill?type=students`)
      const silent = (drill.body.students as { studentId: number; answered: number }[]).filter(
        (r) => r.answered === 0,
      )
      const ev = (await call<CcEvaluation>(teacher, `${BASE}/evaluate`)).body
      for (const r of silent) {
        const row = ev.alerts.find((a) => a.studentId === r.studentId)
        expect(row, String(r.studentId)).toBeDefined()
        const days = Number(/^Tiada aktiviti (\d+) hari$/.exec(row?.alerts[0]?.message ?? '')?.[1])
        expect(days).toBeGreaterThanOrEqual(7)
        expect(row?.alerts.some((a) => a.message.startsWith('Ketepatan'))).toBe(false)
        found++
      }
    }
    expect(found).toBeGreaterThan(0)
  })
})

describe('#9 achievements and #10 badge holders', () => {
  it('lists the three M14 badges with no holder among the pupils of account 5', async () => {
    const a = (await call<CcAchievements>(GURU, `${BASE}/achievements`)).body
    expect(a.totalStudents).toBe(8)
    expect(a.badgeStats.map((b) => [b.id, b.name, b.holders])).toEqual([
      [1, 'Pemula Rajin', 0],
      [2, 'Pelajar Aktif', 0],
      [3, 'Pengumpul', 0],
    ])
    expect(a.topCollectors).toEqual([])
    expect(a.totalNew).toBe(0)
  })

  it('returns the holders of a badge, 404 for an unknown one and 422 for a bad id', async () => {
    const r = await call<CcBadgeHolders>(GURU, `${BASE}/badge-holders?badgeId=1`)
    expect(r.status).toBe(200)
    expect(r.body.badge.name).toBe('Pemula Rajin')
    expect(r.body.holders).toEqual([])
    expect((await call(GURU, `${BASE}/badge-holders?badgeId=999`)).status).toBe(404)
    expect((await call(GURU, `${BASE}/badge-holders`)).status).toBe(422)
    expect((await call(GURU, `${BASE}/badge-holders?badgeId=x`)).status).toBe(422)
  })
})

describe('#5 generate and #6 cancel (state changes, last)', () => {
  const post = (path: string, body: unknown, as = GURU) =>
    call<Record<string, unknown> & Err>(as, `${BASE}/remedial/${path}`, 'POST', body)

  it('validates the body (422)', async () => {
    expect((await post('generate', {})).status).toBe(422)
    expect((await post('generate', { studentId: 3001 })).status).toBe(422)
    expect((await post('generate', { studentId: 'x', subject: 'Kimia' })).status).toBe(422)
    expect((await post('cancel', {})).status).toBe(422)
  })

  it("refuses a student that is not the viewer's with 403 (also for the admin)", async () => {
    expect((await post('generate', { studentId: 2, subject: 'Kimia' })).status).toBe(403)
    expect((await post('generate', { studentId: 3001, subject: 'Kimia' }, ADMIN)).status).toBe(403)
  })

  it('refuses an unknown subject (422) and a pupil without a weak topic in it (422)', async () => {
    expect((await post('generate', { studentId: 3001, subject: 'Tiada Subjek' })).status).toBe(422)
    const r = await post('generate', { studentId: 3001, subject: 'Kimia' })
    expect(r.status).toBe(422)
    expect(r.body.error.message).toBe('Tiada soalan untuk topik lemah')
  })

  it('refuses a second open test for the same pupil and subject (7601 is open)', async () => {
    const r = await post('generate', { studentId: 3008, subject: 'Kimia' })
    expect(r.status).toBe(422)
    expect(r.body.error.message).toContain('aktif')
  })

  it('cancels 7601, then generates a new active test for 3008 through remedialTests', async () => {
    expect((await post('cancel', { quizId: 7601 })).body).toEqual({ success: true })
    expect(remedialTests.forStudent(3008).find((t) => t.id === 7601)?.status).toBe('cancelled')
    expect((await post('cancel', { quizId: 7601 })).status).toBe(409)
    const scan = (await call<CcRemedialScan>(GURU, `${BASE}/remedial/scan`)).body
    expect(scan.existingRemedials.map((t) => [t.id, t.status])).toEqual([[7602, 'completed']])

    const g = await post('generate', { studentId: 3008, subject: 'Kimia' })
    expect(g.status).toBe(201)
    const quizId = g.body.quizId as number
    const total = g.body.totalQuestions as number
    expect(total).toBeGreaterThan(0)
    expect(total).toBeLessThanOrEqual(10)
    const row = remedialTests.forStudent(3008).find((t) => t.id === quizId)
    expect(row).toMatchObject({
      teacherId: GURU,
      studentId: 3008,
      subjectName: 'Kimia',
      status: 'active',
      totalQuestions: total,
      beforeAccuracy: 12.5,
      afterAccuracy: null,
    })
    expect(row?.questionIds).toHaveLength(total)

    // BR-M10-12: the eligible questions 3008 answered wrongly inside the weak topics come first
    const answers = practice.answers(3008).filter((a) => a.subjectId === 10)
    const sp = new Map(
      questions.getMany(answers.map((a) => a.questionId)).map((q) => [q.id, q.dskpSpId]),
    )
    const bySp = new Map<number | null | undefined, { n: number; ok: number }>()
    for (const a of answers) {
      const c = bySp.get(sp.get(a.questionId)) ?? { n: 0, ok: 0 }
      c.n++
      if (a.isCorrect) c.ok++
      bySp.set(sp.get(a.questionId), c)
    }
    const weak = new Set(
      [...bySp].filter(([, c]) => c.n >= 2 && (c.ok / c.n) * 100 < 50).map(([k]) => k),
    )
    const wanted: number[] = []
    for (const a of [...answers].reverse()) {
      if (a.isCorrect || !weak.has(sp.get(a.questionId)) || wanted.includes(a.questionId)) continue
      if (questions.eligibleForPractice(a.questionId)) wanted.push(a.questionId)
    }
    expect(wanted.length).toBeGreaterThan(0)
    const head = Math.min(10, wanted.length)
    expect(row?.questionIds.slice(0, head)).toEqual(wanted.slice(0, head))
    expect(new Set(row?.questionIds).size).toBe(total)
    const after = (await call<CcRemedialScan>(GURU, `${BASE}/remedial/scan`)).body
    expect(after.existingRemedials.map((t) => t.id)).toEqual([quizId, 7602])
  })

  it('answers 404 for an unknown test or one not owned (no probing) and 409 for a completed one', async () => {
    expect((await post('cancel', { quizId: 99999999 })).status).toBe(404)
    expect((await post('cancel', { quizId: 7602 })).status).toBe(409)
    // the admin owns no test: a test of another teacher answers like an unknown id
    expect((await post('cancel', { quizId: 7602 }, ADMIN)).status).toBe(404)
  })
})

describe('rules', () => {
  it('maps percent to grade and grade to risk (BR-M10-14)', () => {
    expect(gradeOfPercent(90)).toBe('A+')
    expect(gradeOfPercent(52)).toBe('C')
    expect(gradeOfPercent(39.9)).toBe('G')
    expect(predictionRisk('G')).toBe('kritikal')
    expect(predictionRisk('E')).toBe('kritikal')
    expect(predictionRisk('D')).toBe('tinggi')
    expect(predictionRisk('C+')).toBe('sederhana')
    expect(predictionRisk('B')).toBe('rendah')
    expect([trendLabel(5.1), trendLabel(-5.1), trendLabel(5), trendLabel(-5)]).toEqual([
      'Naik',
      'Turun',
      'Stabil',
      'Stabil',
    ])
  })

  it('bands engagement (BR-M10-09) and ranks alerts (BR-M10-15)', () => {
    expect(engagementBand(5, 5)).toBe('champion')
    expect(engagementBand(3, 3)).toBe('consistent')
    expect(engagementBand(1, 1)).toBe('developing')
    expect(engagementBand(0, 4)).toBe('minimum')
    expect(engagementBand(0, 0)).toBe('disengaged')
    expect([0, 1, 2, 3].map(evaluationRisk)).toEqual([null, 'medium', 'high', 'critical'])
  })

  it('computes the week change, the drill grade and the rarity', () => {
    expect(weekChange(36, 47)).toBe(-23)
    expect(weekChange(5, 0)).toBe(0)
    expect([weekChange(1, 8), weekChange(9, 8), weekChange(6, 8)]).toEqual([-88, 13, -25]) // half away from zero
    expect([1.5, 4.69, 5.01].map(drillGradeOfGps)).toEqual(['A+', 'D', 'E'])
    expect([20, 10, 5, 1, 0].map(rarityOfHolders)).toEqual([
      'Biasa',
      'Kurang Biasa',
      'Jarang',
      'Epik',
      'Legenda',
    ])
  })
})
