import {
  CommandCenterGuruEvaluationSchema,
  CommandCenterGuruLiveDataSchema,
  CommandCenterGuruPredictiveSchema,
  CommandCenterGuruAchievementsSchema,
} from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  bootCommandCenterApp,
  buildWorld,
  type CcTestApp,
  createAnswers,
  createClass,
  createUser,
  enrol,
  getAs,
  loginRole,
  login,
  type LoggedIn,
  type World,
} from './helpers'

let t: CcTestApp
let w: World
let teacher: LoggedIn
let admin: LoggedIn
let schoolAdmin: LoggedIn

beforeAll(async () => {
  t = await bootCommandCenterApp()
  w = await buildWorld(t)
  teacher = await loginRole(t, 'teacher')
  admin = await loginRole(t, 'admin')
  schoolAdmin = await loginRole(t, 'school_admin')
})
afterAll(async () => {
  await t.close()
})

describe('GET /guru/command-center/live-data', () => {
  it('returns the contract shape with consistent figures over the teacher\'s own pupils (is_test and foreign pupils excluded)', async () => {
    const res = await getAs(teacher, '/guru/command-center/live-data')
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.headers['cache-control']).toBe('no-store')
    const body = CommandCenterGuruLiveDataSchema.parse(res.body)
    expect(body.totalStudentsRaw).toBe(3)
    expect(body.totalStudents).toBe('3')
    expect(body.activeStudentsRaw).toBe(3)
    // 3 pupils x (10 today + 2 yesterday); the is_test pupil (50), the loose pupil and school 2 are not counted.
    expect(body.answeredTodayRaw).toBe(30)
    expect(body.answeredWeekRaw).toBe(36)
    expect(body.totalAnsweredRaw).toBe(36)
    expect(body.weekChange).toBe(0)
    expect(body.accuracy).toBe(72)
    expect(body.gpsOverall).toBeNull()
    expect(body.kirkT4Gps).toBe(0)
    expect(body.kirkT1).toBe(0)
    expect(body.kirkT1Count).toBe(0)
    expect(body.mood).toEqual({ happy: 0, okay: 0, sad: 0, stressed: 0 })
    expect(body.recentBadges).toEqual([])
    expect(body.generatedAt).toBe('2026-10-19T09:00:00.000+08:00')
    // classes: the active class only, level as the contract grade code (grade 10 = TINGKATAN_4), counts consistent with the totals
    expect(body.classes).toEqual([{ id: w.class1, name: 'Kelas Satu', educationLevel: 'TINGKATAN_4', studentCount: 3, active: 3, accuracy: 72 }])
    expect(body.classes.reduce((n, c) => n + c.studentCount, 0)).toBe(body.totalStudentsRaw)
    expect(body.topStudents).toHaveLength(3)
    expect(body.topStudents.map((s) => s.accuracy)).toEqual([75, 75, 67])
    expect(body.leaderboardWeek.map((s) => s.answered)).toEqual([12, 12, 12])
    expect(body.engagement).toEqual({ champion: 0, consistent: 0, developing: 3, minimum: 0, disengaged: 0 })
    expect(body.engagement.developing + body.engagement.champion + body.engagement.consistent + body.engagement.minimum + body.engagement.disengaged).toBe(body.totalStudentsRaw)
    expect(body.recentFeed).toHaveLength(10)
    expect(body.recentFeed[0]?.time).toMatch(/^\d{2}:\d{2}$/)
    expect(body.kirkT2Accuracy).toBe(72)
    expect(body.kirkT2Prev).toBe(0)
    expect(body.kirkT2Delta).toBe(72)
    expect(body.kirkT3Active).toBe(3)
    expect(body.kirkT3Prev).toBe(0)
  })

  it('admin sees only the figures of own classes (none), never the platform', async () => {
    const res = await getAs(admin, '/guru/command-center/live-data')
    expect(res.status).toBe(200)
    const body = CommandCenterGuruLiveDataSchema.parse(res.body)
    expect(body.totalStudentsRaw).toBe(0)
    expect(body.totalAnsweredRaw).toBe(0)
    expect(body.classes).toEqual([])
    expect(body.topStudents).toEqual([])
    expect(body.engagement).toEqual({ champion: 0, consistent: 0, developing: 0, minimum: 0, disengaged: 0 })
    expect(body.accuracy).toBe(0)
  })

  it('a second teacher sees only own school 2 pupil', async () => {
    const t2 = await db1(`select email from users where id = $1::bigint`, [w.teacher2Id])
    const who = await login(t, t2)
    const body = CommandCenterGuruLiveDataSchema.parse((await getAs(who, '/guru/command-center/live-data')).body)
    expect(body.totalStudentsRaw).toBe(1)
    expect(body.totalAnsweredRaw).toBe(6)
    expect(body.classes[0]?.educationLevel).toBe('TINGKATAN_1')
  })

  it('answers 304 with an empty body when If-None-Match matches (generatedAt does not change the tag)', async () => {
    const first = await getAs(teacher, '/guru/command-center/live-data')
    const tag = first.headers.etag as string
    expect(tag).toBeTruthy()
    t.clock.advance(1000)
    const again = await teacher.agent.get('/api/guru/command-center/live-data').set('If-None-Match', tag)
    expect(again.status).toBe(304)
    expect(again.headers['cache-control']).toBe('no-store')
    expect(again.text ?? '').toBe('')
  })

  it('a school admin is 403', async () => {
    expect((await getAs(schoolAdmin, '/guru/command-center/live-data')).status).toBe(403)
  })
})

describe('GET /guru/command-center/evaluate and /predictive', () => {
  it('evaluate: empty alerts for active healthy pupils, summary counts the viewer\'s pupils', async () => {
    const body = CommandCenterGuruEvaluationSchema.parse((await getAs(teacher, '/guru/command-center/evaluate')).body)
    expect(body.summary).toEqual({ totalStudents: 3, atRisk: 0, critical: 0, high: 0, medium: 0 })
    expect(body.alerts).toEqual([])
  })

  it('predictive: all three pupils have >= 10 answers; distribution sums to the total', async () => {
    const body = CommandCenterGuruPredictiveSchema.parse((await getAs(teacher, '/guru/command-center/predictive')).body)
    expect(body.totalPredicted).toBe(3)
    expect(body.predictions.map((p) => p.overallAccuracy)).toEqual([67, 75, 75])
    expect(body.predictions.map((p) => p.predictedGrade)).toEqual(['B+', 'A-', 'A-'])
    expect(Object.keys(body.gradeDistribution)).toHaveLength(10)
    expect(Object.values(body.gradeDistribution).reduce((a, b) => a + b, 0)).toBe(body.totalPredicted)
    expect(body.gradeDistribution['A-']).toBe(2)
    expect(body.atRiskCount).toBe(0)
    expect(body.avgPredictedGps).toBe(2.33)
    expect(body.predictions[0]?.trend).toBe(0)
    expect(body.predictions[0]?.trendLabel).toBe('Stabil')
    expect(body.predictions[0]?.consistency).toBe(7)
  })

  it('evaluate flags an idle pupil with no answer ever (inactive since enrolment, at least 7 days) and a low-accuracy pupil', async () => {
    const school = w.school1
    const cls = await createClass(t.db, { teacherId: w.teacherId, schoolId: school, name: 'Kelas Risiko', grade: 9 })
    const idle = await createUser(t.db, { role: 'student', schoolId: school, name: 'Murid Senyap' })
    await enrol(t.db, cls, idle.id, { joinedAt: '2026-10-01T10:00:00+08:00' })
    const weak = await createUser(t.db, { role: 'student', schoolId: school, name: 'Murid Lemah' })
    await enrol(t.db, cls, weak.id)
    await createAnswers(t.db, { userId: weak.id, at: '2026-10-05T10:00:00+08:00', count: 10, correct: 2 })
    const body = CommandCenterGuruEvaluationSchema.parse((await getAs(teacher, '/guru/command-center/evaluate')).body)
    const idleRow = body.alerts.find((a) => a.studentId === idle.id)
    expect(idleRow?.riskLevel).toBe('medium')
    expect(idleRow?.alerts[0]).toEqual({ message: 'Tiada aktiviti 18 hari', suggestion: 'Hubungi pelajar dan ingatkan untuk menjawab soalan setiap hari.' })
    const weakRow = body.alerts.find((a) => a.studentId === weak.id)
    expect(weakRow?.riskLevel).toBe('high')
    expect(weakRow?.alerts.map((a) => a.message)).toEqual(['Tiada aktiviti 14 hari', 'Ketepatan rendah (20%)'])
    expect(body.summary.atRisk).toBe(2)
    expect(body.summary.high).toBe(1)
    expect(body.summary.medium).toBe(1)
    expect(body.summary.totalStudents).toBe(5)
    expect(body.alerts.map((a) => a.riskLevel)).toEqual(['high', 'medium'])
    // the low-accuracy pupil is also predicted (10 answers, 20%) as G, kritikal
    const pred = CommandCenterGuruPredictiveSchema.parse((await getAs(teacher, '/guru/command-center/predictive')).body)
    const p = pred.predictions.find((x) => x.studentId === weak.id)
    expect(p).toMatchObject({ overallAccuracy: 20, predictedGrade: 'G', predictedGps: 9, risk: 'kritikal' })
    expect(pred.predictions[0]?.studentId).toBe(weak.id)
    expect(pred.atRiskCount).toBe(1)
  })
})

describe('GET /guru/command-center/achievements (empty badge port)', () => {
  it('returns the empty shape with the viewer\'s student total', async () => {
    const body = CommandCenterGuruAchievementsSchema.parse((await getAs(teacher, '/guru/command-center/achievements')).body)
    expect(body).toMatchObject({ badgeStats: [], topCollectors: [], newAwards: [], totalNew: 0 })
    expect(body.totalStudents).toBeGreaterThanOrEqual(3)
  })
})

async function db1(sql: string, args: unknown[]): Promise<string> {
  const rows = await t.db.query<{ email: string }>(sql, args)
  return rows[0]?.email as string
}
