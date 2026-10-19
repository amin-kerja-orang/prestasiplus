import { OpenAPIRegistry, OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi'
import { describe, expect, it } from 'vitest'

import { ErrorBodySchema } from '../../../common/error'
import {
  CommandCenterClassSchema,
  CommandCenterDailyActivityResponseSchema,
  CommandCenterDailyActivitySchema,
  CommandCenterHeadcountDetailSchema,
  CommandCenterLiveDataResponseSchema,
  CommandCenterLiveDataSchema,
  CommandCenterSchoolDrillSchema,
  CommandCenterSchoolSchema,
  CommandCenterSessionDetailSchema,
  CommandCenterSessionListSchema,
  CommandCenterSessionParamsSchema,
  CommandCenterStudentSchema,
  CommandCenterStudentSubjectQuerySchema,
  CommandCenterStudentWeekQuerySchema,
  CommandCenterTeacherSchema,
  ServerStatusResponseSchema,
  ServerStatusSchema,
} from '../admin'
import { COMMAND_CENTER_ADMIN_COMPONENT_SCHEMAS, registerCommandCenterAdminPaths } from '../admin-paths'

// Fictitious values throughout; shapes follow the M17 mock handlers.
const ts = '2026-10-19T09:30:00+08:00'

const live = {
  generatedAt: ts,
  scope: 'platform',
  school: null,
  totalSchools: 57,
  totalStudents: 1200,
  activeStudents: 640,
  totalAnswered: 25000,
  answeredToday: 310,
  answeredWeek: 1900,
  answeredLastWeek: 1700,
  weekChange: 12,
  accuracy: 71.4,
  topSchools: [{ schoolId: '1001', schoolName: 'SK Contoh Satu', activeCount: 80, totalAnswers: 4000 }],
  topStudents: [
    { studentId: '501', name: 'Murid Contoh A', schoolName: 'SK Contoh Satu', answersCount: 120, accuracy: 88.3 },
    { studentId: '502', name: 'Murid Contoh B', schoolName: null, answersCount: 90, accuracy: 70 },
  ],
  gpsOverall: 2.345,
  kirk: { t1: { value: 4.2, scale: 5, count: 33 }, t2Accuracy: 71.4, t3Active: 400, t4Gps: 2.345 },
  engagement: { champion: 29, consistent: 11, developing: 43, minimum: 3, disengaged: 2229 },
  dailyTrend: [],
  mood: { happy: 10, okay: 5, sad: 2, stressed: 1 },
  recentFeed: [
    { student: 'Murid Contoh A', subject: 'MAT', correct: true, time: '09:21', schoolId: '1001', schoolName: 'SK Contoh Satu' },
    { student: 'Murid Contoh C', subject: 'BM', correct: false, time: '09:20', schoolId: null, schoolName: null },
  ],
  correction: { total: 899, avgImprovement: 0, improvedCount: 0, topImprovers: [] },
}

const schoolLive = {
  ...live,
  scope: 'school',
  school: { id: '1001', name: 'SK Contoh Satu' },
  totalSchools: 1,
  topSchools: [],
  engagement: { champion: 0, consistent: 0, developing: 0, minimum: 0, disengaged: 0 },
  dailyTrend: [
    { date: '2026-10-18', label: 'Ahd', count: 3 },
    { date: '2026-10-19', label: 'Isn', count: 9 },
  ],
  correction: { total: 0, avgImprovement: 0, improvedCount: 0, topImprovers: [] },
}

const daily = {
  period: 'today',
  label: 'Hari Ini (19 Oct 2026)',
  scope: 'platform',
  school: null,
  logins: {
    total: 14,
    byRole: { student: 10, teacher: 3, admin: 1 },
    recent: [
      { userId: '501', name: 'Murid Contoh A', role: 'student', lastLoginAt: ts, schoolId: '1001', schoolName: 'SK Contoh Satu', package: 'AKTIF', timeAgo: '5 minutes ago' },
      { userId: '502', name: 'Murid Contoh B', role: 'student', lastLoginAt: ts, schoolId: null, schoolName: null, package: 'FREE', timeAgo: '1 hour ago' },
    ],
  },
  practice: { totalAnswers: 310, correctAnswers: 220, accuracy: 71, activeStudents: 40, sessionsStarted: 25, sessionsCompleted: 25, avgSessionSeconds: 412 },
  engagement: {
    moodCheckins: 4,
    moodDist: { happy: 2, okay: 1, sad: 1, stressed: 0 },
    missionsCompleted: 2,
    badgesEarned: 1,
    recentBadges: [{ userId: '501', name: 'Murid Contoh A', badgeName: 'Pemula', icon: 'star', awardedAt: ts }],
    quizSetsCreated: 0,
  },
  summary: { activeSchools: 6, totalSchools: 57, activeStudents: 40, totalStudents: 1200, totalLogins: 14 },
  schools: [
    { schoolId: '1001', schoolName: 'SK Contoh Satu', activeStudents: 12, totalAnswers: 100, accuracy: 70.5, activeTeachers: 2, loginCount: 5, lastActive: ts, lastActiveHuman: '3 minutes ago' },
    { schoolId: '1002', schoolName: 'SK Contoh Dua', activeStudents: 0, totalAnswers: 0, accuracy: null, activeTeachers: 0, loginCount: 1, lastActive: null, lastActiveHuman: '' },
  ],
  topStudents: [{ userId: '501', name: 'Murid Contoh A', schoolId: '1001', schoolName: 'SK Contoh Satu', answers: 50, accuracy: 90 }],
  subjectBreakdown: [{ code: 'MAT', shortName: 'MAT', answers: 120 }],
  hourlyHeatmap: { '8': 20, '9': 45 },
  liveFeed: [
    { studentId: '501', student: 'Murid Contoh A', subject: 'MAT', correct: true, time: '09:21', schoolId: '1001', schoolName: 'SK Contoh Satu' },
  ],
}

const schoolDrill = {
  school: { id: '1001', name: 'SK Contoh Satu' },
  period: 'week',
  teachers: [{ userId: '301', name: 'Guru Contoh', students: 12, accuracy: 70.5, lastActiveHuman: '3 minutes ago' }],
  students: [{ userId: '501', name: 'Murid Contoh A', answers: 50, accuracy: 90, lastActiveHuman: '3 minutes ago' }],
  logins: [{ userId: '301', name: 'Guru Contoh', role: 'teacher', timeAgo: '1 hour ago' }],
}

const school = {
  school: { id: '1001', name: 'SK Contoh Satu' },
  cards: { students: 120, active: 80, answers: 4000, accuracy: 72.3 },
  teachers: [{ userId: '301', name: 'Guru Contoh', subjectText: null, classes: 2, students: 40, active30d: 30, ownerOnly: false }],
}

const teacher = {
  school: { id: '1001', name: 'SK Contoh Satu' },
  teacher: { id: '301', name: 'Guru Contoh' },
  classes: [{ id: '71', name: '5 Bestari', level: 'D5', students: 30, active30d: 20, answers: 900, accuracy: 68.2 }],
}

const classroom = {
  school: null,
  teacher: { id: '301', name: 'Guru Contoh' },
  class: { id: '71', name: '5 Bestari', level: 'D5' },
  students: [
    { userId: '501', name: 'Murid Contoh A', answers: 50, accuracy: 90, lastActiveAt: ts, status: 'aktif', mood: 'happy' },
    { userId: '503', name: 'Murid Contoh D', answers: 0, accuracy: 0, lastActiveAt: null, status: 'tidak_aktif', mood: null },
  ],
}

const weeks = Array.from({ length: 8 }, (_, i) => ({
  start: `2026-0${(i % 9) + 1}-01`,
  end: `2026-0${(i % 9) + 1}-07`,
  label: '01/0' + ((i % 9) + 1),
  count: i * 3,
}))

const student = {
  school: { id: '1001', name: 'SK Contoh Satu' },
  teacher: { id: '301', name: 'Guru Contoh' },
  class: { id: '71', name: '5 Bestari', level: 'D5' },
  student: { id: '501', name: 'Murid Contoh A' },
  cards: { answers: 50, accuracy: 90, activeDays: 12, streak: 3, consistency: 21 },
  subjects: [
    { code: 'MAT', label: 'Matematik', correct: 20, total: 25, pct: 80 },
    { code: 'UMUM', label: 'Latihan Bebas', correct: 5, total: 10, pct: 50 },
  ],
  weeks,
  moodTrend: [{ date: '2026-10-18', mood: 'okay', reason: null }],
  headcount: [{ configId: '9', subject: 'Matematik', tov: 70, etr: 80, rs: 75, grade: 'B', date: '2026-09-01' }],
  insight: { texts: ['Pelajar konsisten.'], source: 'Rule-based Analysis' },
}

const sessionList = {
  totalAnswers: 20,
  totalSessions: 2,
  accuracy: 85,
  timeSpentMinutes: 14,
  sessions: [
    { id: 'A2', completedAt: ts, subjectLabel: 'Umum', topic: 'Latihan Bebas', total: 10, correct: 8, accuracy: 80, minutes: 6 },
    { id: 's_abc-1', completedAt: ts, subjectLabel: 'Matematik', topic: null, total: 10, correct: 9, accuracy: 90, minutes: 8 },
  ],
}

const sessionDetail = {
  subjectLabel: 'Matematik',
  topic: 'Pecahan',
  completedAt: ts,
  total: 2,
  correctCount: 1,
  wrongCount: 1,
  accuracy: 50,
  timeSpent: { m: 3, s: 20 },
  difficulty: 2,
  answers: [
    { no: 1, correct: true, questionText: 'Berapakah 1/2 + 1/2?', selectedAnswer: 'A) 1', correctAnswer: 'A) 1', answeredAt: ts },
    { no: 2, correct: false, questionText: 'Soalan terbuka', selectedAnswer: null, correctAnswer: null, answeredAt: ts },
  ],
}

const headcount = {
  subject: 'Matematik',
  totalStudents: 2,
  avgTov: 70.5,
  avgEtr: 0,
  passRate: 50,
  students: [
    { userId: '501', name: 'Murid Contoh A', tov: 70, etr: null, rs: null, grade: 'B' },
    { userId: '503', name: 'Murid Contoh D', tov: null, etr: null, rs: null, grade: null },
  ],
}

const status = {
  cpuPct: 6,
  ramPct: 52,
  diskPct: 50,
  uptime: '204d 2h',
  load: 0.15,
  cores: 8,
  ramUsedGb: 16.2,
  ramTotalGb: 31.1,
  diskUsedGb: 199.3,
  diskTotalGb: 398.7,
}

describe('live board', () => {
  it('parses the platform and the school view', () => {
    expect(CommandCenterLiveDataSchema.safeParse(live).success).toBe(true)
    expect(CommandCenterLiveDataResponseSchema.safeParse({ data: schoolLive }).success).toBe(true)
  })

  it('rejects numeric ids, an unknown scope, a non-MYT timestamp and a bad feed time', () => {
    expect(CommandCenterLiveDataSchema.safeParse({ ...live, school: { id: 1001, name: 'x' } }).success).toBe(false)
    expect(CommandCenterLiveDataSchema.safeParse({ ...live, scope: 'global' }).success).toBe(false)
    expect(CommandCenterLiveDataSchema.safeParse({ ...live, generatedAt: '2026-10-19T01:30:00Z' }).success).toBe(false)
    const badFeed = [{ ...live.recentFeed[0], time: '9:21' }]
    expect(CommandCenterLiveDataSchema.safeParse({ ...live, recentFeed: badFeed }).success).toBe(false)
  })

  it('rejects negative counts, accuracy over 100 and a missing kirk scale', () => {
    expect(CommandCenterLiveDataSchema.safeParse({ ...live, totalAnswered: -1 }).success).toBe(false)
    expect(CommandCenterLiveDataSchema.safeParse({ ...live, accuracy: 100.5 }).success).toBe(false)
    expect(
      CommandCenterLiveDataSchema.safeParse({ ...live, kirk: { ...live.kirk, t1: { value: 4, scale: 10, count: 1 } } }).success,
    ).toBe(false)
  })

  it('rejects more than 5 top schools and a non-empty topImprovers', () => {
    const six = Array.from({ length: 6 }, () => live.topSchools[0])
    expect(CommandCenterLiveDataSchema.safeParse({ ...live, topSchools: six }).success).toBe(false)
    expect(
      CommandCenterLiveDataSchema.safeParse({ ...live, correction: { ...live.correction, topImprovers: [{}] } }).success,
    ).toBe(false)
  })
})

describe('daily activity', () => {
  it('parses the platform board and a school-admin board without `schools`', () => {
    expect(CommandCenterDailyActivityResponseSchema.safeParse({ data: daily }).success).toBe(true)
    const withoutSchools: Record<string, unknown> = { ...daily }
    delete withoutSchools.schools
    const schoolBoard = { ...withoutSchools, scope: 'school', school: { id: '1001', name: 'SK Contoh Satu' }, hourlyHeatmap: {} }
    expect(CommandCenterDailyActivitySchema.safeParse(schoolBoard).success).toBe(true)
  })

  it('echoes any raw period text and accepts an empty heatmap', () => {
    expect(CommandCenterDailyActivitySchema.safeParse({ ...daily, period: 'bulan-lalu' }).success).toBe(true)
  })

  it('rejects an unknown package chip, a non-integer count and a missing field', () => {
    const recent = [{ ...daily.logins.recent[0], package: 'GOLD' }]
    expect(CommandCenterDailyActivitySchema.safeParse({ ...daily, logins: { ...daily.logins, recent } }).success).toBe(false)
    expect(CommandCenterDailyActivitySchema.safeParse({ ...daily, summary: { ...daily.summary, totalLogins: 1.5 } }).success).toBe(false)
    const noPractice: Record<string, unknown> = { ...daily }
    delete noPractice.practice
    expect(CommandCenterDailyActivitySchema.safeParse(noPractice).success).toBe(false)
  })

  it('parses the school drill and rejects a numeric school id', () => {
    expect(CommandCenterSchoolDrillSchema.safeParse(schoolDrill).success).toBe(true)
    expect(CommandCenterSchoolDrillSchema.safeParse({ ...schoolDrill, school: { id: 1001, name: 'x' } }).success).toBe(false)
  })
})

describe('drill-down pages', () => {
  it('parses S4 to S7', () => {
    expect(CommandCenterSchoolSchema.safeParse(school).success).toBe(true)
    expect(CommandCenterTeacherSchema.safeParse(teacher).success).toBe(true)
    expect(CommandCenterClassSchema.safeParse(classroom).success).toBe(true)
    expect(CommandCenterStudentSchema.safeParse(student).success).toBe(true)
  })

  it('parses a pupil with no class, teacher or school (admin view of a loose pupil)', () => {
    expect(CommandCenterStudentSchema.safeParse({ ...student, school: null, teacher: null, class: null }).success).toBe(true)
  })

  it('rejects a bad pupil status, mood or mood-less shape, and not-8 weeks', () => {
    const bad = { ...classroom, students: [{ ...classroom.students[0], status: 'active' }] }
    expect(CommandCenterClassSchema.safeParse(bad).success).toBe(false)
    const badMood = { ...classroom, students: [{ ...classroom.students[0], mood: 'angry' }] }
    expect(CommandCenterClassSchema.safeParse(badMood).success).toBe(false)
    expect(CommandCenterStudentSchema.safeParse({ ...student, weeks: weeks.slice(0, 7) }).success).toBe(false)
    expect(CommandCenterStudentSchema.safeParse({ ...student, insight: { texts: [], source: 'AI' } }).success).toBe(false)
  })
})

describe('session lists, session detail and headcount detail', () => {
  it('parses them', () => {
    expect(CommandCenterSessionListSchema.safeParse(sessionList).success).toBe(true)
    expect(CommandCenterSessionListSchema.safeParse({ ...sessionList, totalSessions: 0, sessions: [] }).success).toBe(true)
    expect(CommandCenterSessionDetailSchema.safeParse(sessionDetail).success).toBe(true)
    expect(CommandCenterHeadcountDetailSchema.safeParse(headcount).success).toBe(true)
  })

  it('rejects seconds over 59, a zero answer number and an empty session id', () => {
    expect(CommandCenterSessionDetailSchema.safeParse({ ...sessionDetail, timeSpent: { m: 1, s: 60 } }).success).toBe(false)
    const zero = [{ ...sessionDetail.answers[0], no: 0 }]
    expect(CommandCenterSessionDetailSchema.safeParse({ ...sessionDetail, answers: zero }).success).toBe(false)
    const noId = { ...sessionList, sessions: [{ ...sessionList.sessions[0], id: '' }] }
    expect(CommandCenterSessionListSchema.safeParse(noId).success).toBe(false)
  })

  it('rejects a passRate over 100', () => {
    expect(CommandCenterHeadcountDetailSchema.safeParse({ ...headcount, passRate: 101 }).success).toBe(false)
  })
})

describe('request schemas', () => {
  it('accepts a real range and the all-sessions range', () => {
    expect(CommandCenterStudentWeekQuerySchema.safeParse({ start: '2026-10-12', end: '2026-10-18' }).success).toBe(true)
    expect(CommandCenterStudentWeekQuerySchema.safeParse({ start: '2020-01-01', end: '2030-12-31' }).success).toBe(true)
    expect(CommandCenterStudentWeekQuerySchema.safeParse({ start: '2026-10-12', end: '2026-10-12' }).success).toBe(true)
  })

  it('rejects start after end, a missing date, a non-real date; the issue path is `start`', () => {
    const reversed = CommandCenterStudentWeekQuerySchema.safeParse({ start: '2026-10-18', end: '2026-10-12' })
    expect(reversed.success).toBe(false)
    if (!reversed.success) {
      expect(reversed.error.issues[0]?.path).toEqual(['start'])
      expect(reversed.error.issues[0]?.message).toBe('Julat tarikh tidak sah.')
    }
    expect(CommandCenterStudentWeekQuerySchema.safeParse({ start: '2026-10-12' }).success).toBe(false)
    expect(CommandCenterStudentWeekQuerySchema.safeParse({ start: '2026-02-30', end: '2026-03-01' }).success).toBe(false)
    expect(CommandCenterStudentWeekQuerySchema.safeParse({ start: '12/10/2026', end: '18/10/2026' }).success).toBe(false)
  })

  it('subject code is optional and trimmed', () => {
    expect(CommandCenterStudentSubjectQuerySchema.parse({ code: ' MAT ' })).toEqual({ code: 'MAT' })
    expect(CommandCenterStudentSubjectQuerySchema.safeParse({}).success).toBe(true)
  })

  it('session id allows A2, g1, s_x-1 but not slashes or spaces', () => {
    for (const ok of ['A2', 'g1', 's_abc-1']) {
      expect(CommandCenterSessionParamsSchema.safeParse({ sessionId: ok }).success).toBe(true)
    }
    for (const bad of ['a/b', 'a b', '']) {
      expect(CommandCenterSessionParamsSchema.safeParse({ sessionId: bad }).success).toBe(false)
    }
  })
})

describe('server status', () => {
  it('parses the observed reading and exposes only readings', () => {
    expect(ServerStatusResponseSchema.safeParse({ data: status }).success).toBe(true)
    expect(Object.keys(ServerStatusSchema.shape).sort()).toEqual(
      ['cores', 'cpuPct', 'diskPct', 'diskTotalGb', 'diskUsedGb', 'load', 'ramPct', 'ramTotalGb', 'ramUsedGb', 'uptime'],
    )
  })

  it('rejects a percentage over 100, a malformed uptime and zero cores', () => {
    expect(ServerStatusSchema.safeParse({ ...status, cpuPct: 101 }).success).toBe(false)
    expect(ServerStatusSchema.safeParse({ ...status, uptime: '204 days' }).success).toBe(false)
    expect(ServerStatusSchema.safeParse({ ...status, cores: 0 }).success).toBe(false)
  })
})

describe('error bodies', () => {
  it('the mock error bodies fit ErrorBody', () => {
    expect(ErrorBodySchema.safeParse({ error: { code: 'NOT_FOUND', message: 'Not Found.' } }).success).toBe(true)
    expect(
      ErrorBodySchema.safeParse({
        error: { code: 'VALIDATION_ERROR', message: 'Julat tarikh tidak sah.', fields: { start: 'Julat tarikh tidak sah.' } },
      }).success,
    ).toBe(true)
  })
})

describe('OpenAPI registration (local)', () => {
  const registry = new OpenAPIRegistry()
  for (const [name, schema] of Object.entries(COMMAND_CENTER_ADMIN_COMPONENT_SCHEMAS)) registry.register(name, schema)
  registerCommandCenterAdminPaths(registry)
  const doc = new OpenApiGeneratorV31(registry.definitions).generateDocument({
    openapi: '3.1.0',
    info: { title: 'test', version: '0' },
  })

  const ROUTES = [
    '/admin/command-center/live-data',
    '/command-center/daily-activity',
    '/command-center/daily-activity/school/{id}',
    '/command-center/school/{id}',
    '/command-center/school/{sid}/teacher/{uid}',
    '/command-center/classroom/{id}',
    '/command-center/headcount/{configId}',
    '/command-center/student/{id}',
    '/command-center/student/{id}/subject',
    '/command-center/student/{id}/week',
    '/command-center/session/{sessionId}',
    '/admin/server-status',
  ]

  it('registers the 12 GET paths and nothing else', () => {
    expect(Object.keys(doc.paths ?? {}).sort()).toEqual([...ROUTES].sort())
    for (const path of ROUTES) {
      const item = (doc.paths ?? {})[path] as Record<string, unknown>
      expect(Object.keys(item)).toEqual(['get'])
    }
  })

  it('every component is generated and prefixed CommandCenter or ServerStatus (never CommandCenterGuru)', () => {
    const names = Object.keys(COMMAND_CENTER_ADMIN_COMPONENT_SCHEMAS)
    const components = doc.components?.schemas ?? {}
    for (const name of names) {
      expect(components[name], name).toBeDefined()
      expect(/^(CommandCenter|ServerStatus)/.test(name)).toBe(true)
      expect(name.startsWith('CommandCenterGuru')).toBe(false)
    }
  })

  it('every component key equals its meta id', () => {
    for (const [name, schema] of Object.entries(COMMAND_CENTER_ADMIN_COMPONENT_SCHEMAS)) {
      expect((schema as { meta(): { id?: string } | undefined }).meta()?.id, name).toBe(name)
    }
  })

  it('every route documents 401 and the guard 403; the week route documents 422', () => {
    const paths = doc.paths ?? {}
    for (const path of ROUTES) {
      const responses = ((paths[path] as { get: { responses: Record<string, unknown> } }).get).responses
      expect(responses['200'], path).toBeDefined()
      expect(responses['401'], path).toBeDefined()
      expect(responses['403'], path).toBeDefined()
    }
    const week = (paths['/command-center/student/{id}/week'] as { get: { responses: Record<string, unknown> } }).get.responses
    expect(week['422']).toBeDefined()
    expect(week['404']).toBeDefined()
  })
})
