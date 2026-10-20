import {
  PerformanceAnalyticsSchema,
  PerformanceClassAnalyticsSchema,
  PerformanceClassCardSchema,
  PerformanceClassDashboardSchema,
  PerformanceClassItemAnalysisSchema,
  PerformanceLevelCardSchema,
  PerformanceLevelDetailSchema,
  PerformanceSchoolItemAnalysisSchema,
  PerformanceSchoolSchema,
  PerformanceStudentSchema,
} from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { z } from 'zod'

import { type Client, expectError, loginAs, parseData } from '../../../curriculum/helpers'
import { bootWorld, type World } from './boot'

let w: World
const as: Record<string, Client> = {}
const who = ['pelajar', 'pelajarmaju', 'pelajar2', 'guru', 'adminsekolah', 'admin', 'ppd', 'ibubapa', 'penaja'] as const

beforeAll(async () => {
  w = await bootWorld()
  for (const k of who) as[k] = await loginAs(w, `${k}@demo.test`)
}, 120_000)
afterAll(async () => {
  await w?.close()
})

const noStore = (res: { headers: Record<string, unknown> }) => expect(String(res.headers['cache-control'])).toContain('no-store')

describe('authentication', () => {
  const routes = (): string[] => [
    '/api/analytics/me',
    '/api/analytics/classes',
    `/api/performance/students/${w.ids['pelajar@demo.test']}`,
    '/api/performance/school',
    '/api/performance/levels',
    '/api/performance/levels/t4',
    '/api/performance/classes',
    `/api/performance/classes/${w.classId}`,
    '/api/item-analysis/school',
    `/api/item-analysis/school/${w.schools.demo1}`,
    '/api/item-analysis/classes',
    `/api/item-analysis/classes/${w.classId}`,
  ]

  it('answers 401 on all 12 routes without a session', async () => {
    for (const url of routes()) {
      const res = await w.http().get(url)
      expectError(res, 'UNAUTHORIZED')
    }
  })
})

describe('roles', () => {
  it('parent and sponsor are refused (403) on both school item analyses', async () => {
    for (const k of ['ibubapa', 'penaja']) {
      expectError(await (as[k] as Client).get('/api/item-analysis/school'), 'FORBIDDEN', 'This action is unauthorized.')
      expectError(await (as[k] as Client).get(`/api/item-analysis/school/${w.schools.demo1}`), 'FORBIDDEN')
    }
  })

  it('a student is refused (403) on analytics/classes and the item-analysis class routes', async () => {
    const s = as.pelajar as Client
    expectError(await s.get('/api/analytics/classes'), 'FORBIDDEN')
    expectError(await s.get('/api/item-analysis/classes'), 'FORBIDDEN')
    expectError(await s.get(`/api/item-analysis/classes/${w.classId}`), 'FORBIDDEN')
  })

  it('a school admin is refused (403) on analytics/classes and item-analysis classes', async () => {
    const s = as.adminsekolah as Client
    expectError(await s.get('/api/analytics/classes'), 'FORBIDDEN')
    expectError(await s.get('/api/item-analysis/classes'), 'FORBIDDEN')
  })

  it('every role with a session reads analytics/me, school, levels and classes', async () => {
    for (const k of who) {
      const c = as[k] as Client
      parseData(await c.get('/api/analytics/me'), PerformanceAnalyticsSchema)
      parseData(await c.get('/api/performance/school'), PerformanceSchoolSchema)
      parseData(await c.get('/api/performance/levels'), z.array(PerformanceLevelCardSchema))
      parseData(await c.get('/api/performance/classes'), z.array(PerformanceClassCardSchema))
    }
  })
})

describe('contract shapes and no-store', () => {
  it('teacher: every route parses with its contract schema and is no-store', async () => {
    const t = as.guru as Client
    const cases: [string, z.ZodType][] = [
      ['/api/analytics/classes', PerformanceClassAnalyticsSchema],
      [`/api/performance/students/${w.ids['pelajar@demo.test']}`, PerformanceStudentSchema],
      ['/api/performance/levels/t4', PerformanceLevelDetailSchema],
      [`/api/performance/classes/${w.classId}`, PerformanceClassDashboardSchema],
      ['/api/item-analysis/school', PerformanceSchoolItemAnalysisSchema],
      [`/api/item-analysis/school/${w.schools.demo1}`, PerformanceSchoolItemAnalysisSchema],
      ['/api/item-analysis/classes', z.array(PerformanceClassCardSchema)],
      [`/api/item-analysis/classes/${w.classId}`, PerformanceClassItemAnalysisSchema],
    ]
    for (const [url, schema] of cases) {
      const res = await t.get(url)
      parseData(res, schema)
      noStore(res)
    }
  })

  it('admin: platform school and every class parse', async () => {
    const a = as.admin as Client
    parseData(await a.get('/api/item-analysis/classes'), z.array(PerformanceClassCardSchema))
    parseData(await a.get(`/api/performance/classes/${w.classId}`), PerformanceClassDashboardSchema)
    parseData(await a.get(`/api/item-analysis/school/${w.schools.demo2}`), PerformanceSchoolItemAnalysisSchema)
  })

  it('a service 404 is no-store too (guard refusals carry no data)', async () => {
    noStore(await (as.pelajar as Client).get(`/api/performance/students/${w.ids['pelajarmaju@demo.test']}`))
  })

  it('the figures come from the injected Bijak facts and exclude the test sitting', async () => {
    const dash = parseData(await (as.guru as Client).get(`/api/performance/classes/${w.classId}`), PerformanceClassDashboardSchema)
    expect(dash.stats.sessions).toBe(9)
  })
})

describe('404 versus 403 and hostile ids', () => {
  it('a student opening another pupil is 404, as is an unknown pupil (no enumeration)', async () => {
    const s = as.pelajar as Client
    expectError(await s.get(`/api/performance/students/${w.ids['pelajarmaju@demo.test']}`), 'NOT_FOUND', 'Not Found.')
    expectError(await s.get('/api/performance/students/987654'), 'NOT_FOUND')
    parseData(await s.get(`/api/performance/students/${w.ids['pelajar@demo.test']}`), PerformanceStudentSchema)
  })

  it('a teacher cannot open a pupil outside the own classes (404)', async () => {
    const t = as.guru as Client
    const outsider = (await w.db.query<{ id: string }>(`select id::text from users where name = 'Murid Roster Demo'`))[0]?.id
    expectError(await t.get(`/api/performance/students/${outsider}`), 'NOT_FOUND')
  })

  it('an officer never opens a pupil (404), as for an unknown id', async () => {
    const p = as.ppd as Client
    expectError(await p.get(`/api/performance/students/${w.ids['pelajar@demo.test']}`), 'NOT_FOUND', 'Not Found.')
    expectError(await p.get('/api/performance/students/987654'), 'NOT_FOUND', 'Not Found.')
  })

  it('analytics/classes: an unknown classroomId is 403, like a class the teacher does not own', async () => {
    expectError(await (as.guru as Client).get('/api/analytics/classes?classroomId=987654'), 'FORBIDDEN')
  })

  it('class dashboard: unknown, other school and a student caller give 404', async () => {
    expectError(await (as.guru as Client).get('/api/performance/classes/987654'), 'NOT_FOUND')
    expectError(await (as.guru as Client).get(`/api/performance/classes/${w.otherClassId}`), 'NOT_FOUND')
    expectError(await (as.pelajar as Client).get(`/api/performance/classes/${w.classId}`), 'NOT_FOUND')
  })

  it('level code other than t4 or t5 is 404', async () => {
    expectError(await (as.guru as Client).get('/api/performance/levels/t9'), 'NOT_FOUND')
    expectError(await (as.guru as Client).get('/api/performance/levels/T4'), 'NOT_FOUND')
  })

  it('item-analysis class: unknown and not openable are both 403', async () => {
    const t = as.guru as Client
    expectError(await t.get('/api/item-analysis/classes/987654'), 'FORBIDDEN')
    expectError(await t.get(`/api/item-analysis/classes/${w.otherClassId}`), 'FORBIDDEN')
  })

  it('item-analysis school by id: other school is 403 for non-admin; admin and an unknown id is an empty payload', async () => {
    expectError(await (as.guru as Client).get(`/api/item-analysis/school/${w.schools.demo2}`), 'FORBIDDEN')
    expectError(await (as.guru as Client).get('/api/item-analysis/school/987654'), 'FORBIDDEN')
    const empty = parseData(await (as.admin as Client).get('/api/item-analysis/school/987654'), PerformanceSchoolItemAnalysisSchema)
    expect(empty.questions).toEqual([])
    expect(empty.variant).toBe('byId')
  })

  it('item-analysis own school: the admin has no school (404)', async () => {
    expectError(await (as.admin as Client).get('/api/item-analysis/school'), 'NOT_FOUND')
  })

  it('hostile ids never give 500', async () => {
    const hostile = ['abc', '99999999999999999999999', '..%2F', '1%27%20or%20%271%27=%271', '-1', '0']
    for (const id of hostile) {
      for (const [client, base, code] of [
        [as.guru, '/api/performance/students/', 'NOT_FOUND'],
        [as.guru, '/api/performance/classes/', 'NOT_FOUND'],
        [as.guru, '/api/item-analysis/classes/', 'FORBIDDEN'],
        [as.guru, '/api/item-analysis/school/', 'FORBIDDEN'],
      ] as const) {
        const res = await (client as Client).get(base + id)
        expect(res.status, `${base}${id}`).toBeLessThan(500)
        expect([403, 404]).toContain(res.status)
        expectError(res, code)
      }
    }
  })
})

describe('query validation', () => {
  it('riskLevel=bogus is treated as all, tingkatan=T9 is ignored, unknown keys are ignored', async () => {
    const t = as.guru as Client
    parseData(await t.get('/api/analytics/classes?riskLevel=bogus&x=1'), PerformanceClassAnalyticsSchema)
    const r = parseData(await t.get('/api/item-analysis/school?tingkatan=T9&zzz=1'), PerformanceSchoolItemAnalysisSchema)
    expect(r.tingkatan).toBeNull()
  })

  it('an over-long value is a 422 on that key; a repeated key is a 422', async () => {
    const t = as.guru as Client
    const e = expectError(await t.get(`/api/item-analysis/school?tingkatan=${'T'.repeat(200)}`), 'VALIDATION_ERROR')
    expect(Object.keys(e.fields ?? {})).toContain('tingkatan')
    expectError(await t.get('/api/analytics/classes?classroomId=1&classroomId=2'), 'VALIDATION_ERROR')
    expectError(await t.get(`/api/analytics/classes?classroomId=${'9'.repeat(100)}`), 'VALIDATION_ERROR')
  })
})

describe('privacy', () => {
  const wrongPupils = (r: z.infer<typeof PerformanceSchoolItemAnalysisSchema>) => r.questions.flatMap((q) => q.wrongPupils)

  it('a student gets no pupil rows on the school item analysis, and no question under the minimum cohort', async () => {
    const r = parseData(await (as.pelajar as Client).get('/api/item-analysis/school'), PerformanceSchoolItemAnalysisSchema)
    expect(wrongPupils(r)).toEqual([])
    expect(r.questions.map((q) => q.questionId)).toEqual(['q1'])
  })

  it('an officer gets redacted pupil rows and the same cohort rule', async () => {
    const r = parseData(await (as.ppd as Client).get(`/api/item-analysis/school/${w.schools.demo1}`), PerformanceSchoolItemAnalysisSchema)
    for (const p of wrongPupils(r)) expect(p.name).toBe('Murid')
    expect(r.questions.map((q) => q.questionId)).not.toContain('q2')
  })

  it('a teacher sees every question and the real names of own pupils', async () => {
    const r = parseData(await (as.guru as Client).get('/api/item-analysis/school'), PerformanceSchoolItemAnalysisSchema)
    expect(r.questions.map((q) => q.questionId).sort()).toEqual(['q1', 'q2'])
    const names = wrongPupils(r).map((p) => p.name)
    expect(names.length).toBeGreaterThan(0)
    expect(names).not.toContain('Murid')
    expect(names.every((n) => /^Murid/.test(n))).toBe(true)
  })

  it('a student sees no teacher list and no top or at-risk pupils', async () => {
    const school = parseData(await (as.pelajar as Client).get('/api/performance/school'), PerformanceSchoolSchema)
    expect(school.teachers).toEqual([])
    const level = parseData(await (as.pelajar as Client).get('/api/performance/levels/t4'), PerformanceLevelDetailSchema)
    expect(level.topStudents).toEqual([])
    expect(level.atRisk).toEqual([])
  })
})

describe('real directory adapter', () => {
  it('names come from the users table and the school from the schools table through HTTP', async () => {
    const mine = parseData(await (as.pelajar as Client).get(`/api/performance/students/${w.ids['pelajar@demo.test']}`), PerformanceStudentSchema)
    expect(JSON.stringify(mine)).toContain('Murid Demo')
    const r = parseData(await (as.guru as Client).get('/api/item-analysis/school'), PerformanceSchoolItemAnalysisSchema)
    expect(r.school).toMatchObject({ id: w.schools.demo1, name: 'SMK Demo Satu', state: 'Selangor' })
    expect(r.students).toBeGreaterThanOrEqual(9)
  })
})
