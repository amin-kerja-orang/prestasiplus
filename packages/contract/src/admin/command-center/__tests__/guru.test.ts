import { OpenAPIRegistry, OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi'
import { describe, expect, it } from 'vitest'

import { ErrorBodySchema } from '../../../common/error'
import {
  CommandCenterGuruAchievementsSchema,
  CommandCenterGuruBadgeHoldersQuerySchema,
  CommandCenterGuruBadgeHoldersSchema,
  CommandCenterGuruDrillQuerySchema,
  CommandCenterGuruDrillSchema,
  CommandCenterGuruEvaluationSchema,
  CommandCenterGuruLiveDataSchema,
  CommandCenterGuruPredictiveSchema,
} from '../guru'
import { COMMAND_CENTER_GURU_COMPONENT_SCHEMAS, registerCommandCenterGuruPaths } from '../guru-paths'

const AT = '2026-10-16T09:30:00+08:00'
const rank = { studentId: '201', name: 'Murid Contoh A', answered: 24, accuracy: 75 }

const liveData = {
  teacherName: 'Guru Contoh',
  totalStudents: '1,204',
  totalStudentsRaw: 1204,
  activeStudents: '3',
  activeStudentsRaw: 3,
  totalAnswered: '5,300',
  totalAnsweredRaw: 5300,
  answeredToday: '40',
  answeredTodayRaw: 40,
  answeredWeek: '210',
  answeredWeekRaw: 210,
  weekChange: -12,
  accuracy: 71,
  gpsOverall: null,
  classes: [
    { id: '11', name: '5 Amanah', educationLevel: 'tingkatan-5', studentCount: 30, active: 12, accuracy: 68 },
  ],
  topStudents: [rank],
  leaderboardWeek: [rank],
  recentBadges: [{ studentId: '201', student: 'Murid Contoh A', badge: 'Pemula', icon: 'star', awardedAt: AT }],
  engagement: { champion: 1, consistent: 2, developing: 3, minimum: 4, disengaged: 5 },
  recentFeed: [{ studentId: '201', time: '09:30', student: 'Murid Contoh A', subject: 'Matematik', isCorrect: true }],
  kirkT1: 8.5,
  kirkT1Count: 2,
  kirkT2Accuracy: 70,
  kirkT2Delta: -3,
  kirkT2Prev: 73,
  kirkT3Active: 9,
  kirkT3Delta: 1,
  kirkT3Prev: 8,
  kirkT4Gps: 0,
  mood: { happy: 1, okay: 0, sad: 0, stressed: 2 },
  generatedAt: AT,
}

describe('CommandCenterGuruLiveData', () => {
  it('parses a realistic payload', () => {
    expect(CommandCenterGuruLiveDataSchema.safeParse(liveData).success).toBe(true)
  })
  it('accepts a numeric gps and rejects a bad class level or missing key', () => {
    expect(CommandCenterGuruLiveDataSchema.safeParse({ ...liveData, gpsOverall: 4.69 }).success).toBe(true)
    const bad = { ...liveData, classes: [{ ...liveData.classes[0], educationLevel: 'tingkatan-9' }] }
    expect(CommandCenterGuruLiveDataSchema.safeParse(bad).success).toBe(false)
    const rest: Record<string, unknown> = { ...liveData }
    delete rest.mood
    expect(CommandCenterGuruLiveDataSchema.safeParse(rest).success).toBe(false)
  })
  it('rejects a timestamp without +08:00', () => {
    expect(
      CommandCenterGuruLiveDataSchema.safeParse({ ...liveData, generatedAt: '2026-10-16T01:30:00Z' }).success,
    ).toBe(false)
  })
})

describe('CommandCenterGuruDrill', () => {
  it('parses the student rows', () => {
    const body = {
      title: 'Pelajar Berdaftar',
      students: [
        { studentId: '201', name: 'Murid Contoh A', className: '5 Amanah, 5 Bestari', answered: 10, accuracy: 80, lastActiveAt: null, status: 'Login' },
      ],
    }
    expect(CommandCenterGuruDrillSchema.safeParse(body).success).toBe(true)
  })
  it('parses kirk t1 rows with null relevance and the t2 vs card', () => {
    const t1 = {
      title: 'Kirkpatrick T1',
      students: [
        { studentId: '201', name: 'Murid Contoh A', average: 9, satisfaction: 4, relevance: null, usefulness: null, date: '2026-09' },
      ],
    }
    expect(CommandCenterGuruDrillSchema.safeParse(t1).success).toBe(true)
    const t2 = {
      title: 'Kirkpatrick T2',
      students: [],
      vsLabel: 'Bulan Ini vs Bulan Lepas',
      extra: { accuracyNow: 70, accuracyPrev: 73, accuracyChange: -3, answersNow: 100, answersPrev: 90, activeNow: 9, activePrev: 8, newStudents: 1 },
    }
    expect(CommandCenterGuruDrillSchema.safeParse(t2).success).toBe(true)
  })
  it('parses gps, mood and engagement rows', () => {
    const gps = { title: 'GPS Sekolah', students: [{ subject: 'Sains', gps: 2.5, grade: 'A-', students: 12, source: 'Anggaran OTR' }] }
    const mood = { title: 'Mood Pelajar', students: [{ studentId: '201', name: 'Murid Contoh A', mood: 'happy', date: '2026-10-15', reason: null }] }
    const eng = { title: 'Engagement Pelajar', students: [{ studentId: '201', name: 'Murid Contoh A', band: 'champion', days: 5, answeredWeek: 30, accuracy: 90, lastActiveAt: AT }] }
    for (const b of [gps, mood, eng]) expect(CommandCenterGuruDrillSchema.safeParse(b).success).toBe(true)
  })
  it('rejects a row that matches no shape', () => {
    expect(CommandCenterGuruDrillSchema.safeParse({ title: 'x', students: [{ foo: 1 }] }).success).toBe(false)
  })
  it('validates the query', () => {
    expect(CommandCenterGuruDrillQuerySchema.safeParse({ type: 'kirk', filter: 't2' }).success).toBe(true)
    expect(CommandCenterGuruDrillQuerySchema.safeParse({ type: 'students' }).success).toBe(true)
    expect(CommandCenterGuruDrillQuerySchema.safeParse({ type: 'nope' }).success).toBe(false)
    expect(CommandCenterGuruDrillQuerySchema.safeParse({}).success).toBe(false)
  })
})

describe('CommandCenterGuruPredictive and Evaluation', () => {
  const grades = Object.fromEntries(['A+', 'A', 'A-', 'B+', 'B', 'C+', 'C', 'D', 'E', 'G'].map((g) => [g, 0]))
  it('parses predictions', () => {
    const body = {
      predictions: [
        { studentId: '201', studentName: 'Murid Contoh A', overallAccuracy: 42, trend: -8, trendLabel: 'Turun', consistency: 13, predictedGrade: 'E', predictedGps: 8, risk: 'kritikal' },
      ],
      gradeDistribution: { ...grades, E: 1 },
      avgPredictedGps: 8,
      atRiskCount: 1,
      totalPredicted: 1,
    }
    expect(CommandCenterGuruPredictiveSchema.safeParse(body).success).toBe(true)
    expect(
      CommandCenterGuruPredictiveSchema.safeParse({ ...body, predictions: [{ ...body.predictions[0], risk: 'low' }] }).success,
    ).toBe(false)
  })
  it('parses an empty prediction set', () => {
    const body = { predictions: [], gradeDistribution: grades, avgPredictedGps: 0, atRiskCount: 0, totalPredicted: 0 }
    expect(CommandCenterGuruPredictiveSchema.safeParse(body).success).toBe(true)
  })
  it('parses an evaluation and rejects a bad risk level', () => {
    const body = {
      summary: { totalStudents: 5, atRisk: 1, critical: 0, high: 0, medium: 1 },
      alerts: [
        {
          studentId: '201',
          name: 'Murid Contoh A',
          riskLevel: 'medium',
          alerts: [{ message: 'Tiada aktiviti 9 hari', suggestion: 'Hubungi pelajar dan ingatkan untuk menjawab soalan setiap hari.' }],
        },
      ],
    }
    expect(CommandCenterGuruEvaluationSchema.safeParse(body).success).toBe(true)
    expect(
      CommandCenterGuruEvaluationSchema.safeParse({ ...body, alerts: [{ ...body.alerts[0], riskLevel: 'low' }] }).success,
    ).toBe(false)
  })
})

describe('CommandCenterGuruAchievements and BadgeHolders', () => {
  it('parses achievements', () => {
    const body = {
      totalStudents: 30,
      totalNew: 1,
      badgeStats: [{ id: '3', name: 'Pemula', icon: 'star', color: '#a855f7', holders: 2 }],
      topCollectors: [{ name: 'Murid Contoh A', count: 2 }],
      newAwards: [{ studentId: '201', name: 'Murid Contoh A', badgeName: 'Pemula', icon: 'star', awardedAt: AT }],
    }
    expect(CommandCenterGuruAchievementsSchema.safeParse(body).success).toBe(true)
    expect(
      CommandCenterGuruAchievementsSchema.safeParse({ ...body, badgeStats: [{ ...body.badgeStats[0], color: 'purple' }] }).success,
    ).toBe(false)
  })
  it('parses badge holders', () => {
    const body = {
      badge: { name: 'Pemula', description: '' },
      holders: [{ studentId: '201', name: 'Murid Contoh A', accuracy: 80, awardedAt: AT }],
    }
    expect(CommandCenterGuruBadgeHoldersSchema.safeParse(body).success).toBe(true)
    expect(CommandCenterGuruBadgeHoldersSchema.safeParse({ holders: [] }).success).toBe(false)
  })
  it('validates the badgeId query', () => {
    expect(CommandCenterGuruBadgeHoldersQuerySchema.safeParse({ badgeId: '7' }).success).toBe(true)
    for (const bad of ['0', '-1', 'abc', '1.5', '']) {
      expect(CommandCenterGuruBadgeHoldersQuerySchema.safeParse({ badgeId: bad }).success).toBe(false)
    }
    expect(CommandCenterGuruBadgeHoldersQuerySchema.safeParse({}).success).toBe(false)
  })
})

describe('error bodies', () => {
  it('parses the 422 and 404 shapes of the mock', () => {
    const v = { error: { code: 'VALIDATION_ERROR', message: 'Lencana tidak sah.', fields: { badgeId: 'Lencana tidak sah.' } } }
    const n = { error: { code: 'NOT_FOUND', message: 'Lencana tidak dijumpai.' } }
    expect(ErrorBodySchema.safeParse(v).success).toBe(true)
    expect(ErrorBodySchema.safeParse(n).success).toBe(true)
  })
})

describe('OpenAPI', () => {
  type Doc = {
    paths: Record<string, Record<string, { responses: Record<string, unknown> }>>
    components: { schemas: Record<string, unknown> }
  }
  const registry = new OpenAPIRegistry()
  for (const [name, schema] of Object.entries(COMMAND_CENTER_GURU_COMPONENT_SCHEMAS)) registry.register(name, schema)
  registerCommandCenterGuruPaths(registry)
  const doc = new OpenApiGeneratorV31(registry.definitions).generateDocument({
    openapi: '3.1.0',
    info: { title: 't', version: '0' },
  }) as unknown as Doc

  it('registers the six paths with GET', () => {
    for (const p of ['live-data', 'drill', 'evaluate', 'predictive', 'achievements', 'badge-holders']) {
      expect(doc.paths[`/guru/command-center/${p}`]?.get).toBeDefined()
    }
    expect(Object.keys(doc.paths)).toHaveLength(6)
  })
  it('documents 401/403 everywhere and 422/404 where the mock produces them', () => {
    for (const item of Object.values(doc.paths)) {
      expect(item.get?.responses).toHaveProperty('401')
      expect(item.get?.responses).toHaveProperty('403')
    }
    expect(doc.paths['/guru/command-center/badge-holders']?.get?.responses).toHaveProperty('404')
    expect(doc.paths['/guru/command-center/badge-holders']?.get?.responses).toHaveProperty('422')
    expect(doc.paths['/guru/command-center/drill']?.get?.responses).toHaveProperty('422')
  })
  it('exposes every component under its meta id, all prefixed CommandCenterGuru', () => {
    for (const name of Object.keys(COMMAND_CENTER_GURU_COMPONENT_SCHEMAS)) {
      expect(name.startsWith('CommandCenterGuru')).toBe(true)
      expect(doc.components.schemas).toHaveProperty(name)
    }
  })
})
