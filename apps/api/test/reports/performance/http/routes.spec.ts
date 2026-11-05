import {
  PerformanceAnalyticsSchema,
  PerformanceClassAnalyticsSchema,
  PerformanceClassCardSchema,
  PerformanceClassDashboardSchema,
  PerformanceClassItemAnalysisSchema,
  PerformanceItemAnalysisMeSchema,
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
const who = ['pelajar', 'pelajarmaju', 'pelajar2', 'saya', 'guru', 'adminsekolah', 'admin', 'ppd', 'ibubapa', 'penaja'] as const

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
    '/api/item-analysis/me',
  ]

  it('answers 401 on all 13 routes without a session', async () => {
    for (const url of routes()) {
      const res = await w.http().get(url)
      expectError(res, 'UNAUTHORIZED')
    }
  })
})

describe('roles', () => {
  it('parent and sponsor are refused (403) on both school item analyses', async () => {
    for (const k of ['ibubapa', 'penaja']) {
      expectError(await (as[k] as Client).get('/api/item-analysis/school'), 'FORBIDDEN', 'Anda tidak dibenarkan melakukan tindakan ini.')
      expectError(await (as[k] as Client).get(`/api/item-analysis/school/${w.schools.demo1}`), 'FORBIDDEN')
    }
  })

  it('a student is refused (403) on both school item analyses (AC-MUR-6-5, FR-MUR-6-2)', async () => {
    for (const k of ['pelajar', 'pelajarmaju', 'saya'] as const) {
      expectError(await (as[k] as Client).get('/api/item-analysis/school'), 'FORBIDDEN', 'Anda tidak dibenarkan melakukan tindakan ini.')
      expectError(await (as[k] as Client).get(`/api/item-analysis/school/${w.schools.demo1}`), 'FORBIDDEN')
      expectError(await (as[k] as Client).get(`/api/item-analysis/school/${w.schools.demo2}`), 'FORBIDDEN')
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

  it('every role with a session reads analytics/me', async () => {
    for (const k of who) parseData(await (as[k] as Client).get('/api/analytics/me'), PerformanceAnalyticsSchema)
  })

  it('admin, teacher and school admin read school, levels and classes', async () => {
    for (const k of ['admin', 'guru', 'adminsekolah'] as const) {
      const c = as[k] as Client
      parseData(await c.get('/api/performance/school'), PerformanceSchoolSchema)
      parseData(await c.get('/api/performance/levels'), z.array(PerformanceLevelCardSchema))
      parseData(await c.get('/api/performance/classes'), z.array(PerformanceClassCardSchema))
    }
  })

  it('pupil, parent, sponsor and PPD officer are refused (403) on school, levels, levels/:code, classes and classes/:id', async () => {
    for (const k of ['pelajar', 'pelajarmaju', 'pelajar2', 'ibubapa', 'penaja', 'ppd'] as const) {
      const c = as[k] as Client
      for (const url of ['/api/performance/school', '/api/performance/levels', '/api/performance/levels/t4', '/api/performance/classes', `/api/performance/classes/${w.classId}`]) {
        expectError(await c.get(url), 'FORBIDDEN')
      }
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
    expectError(await s.get(`/api/performance/students/${w.ids['pelajarmaju@demo.test']}`), 'NOT_FOUND', 'Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?')
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
    expectError(await p.get(`/api/performance/students/${w.ids['pelajar@demo.test']}`), 'NOT_FOUND', 'Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?')
    expectError(await p.get('/api/performance/students/987654'), 'NOT_FOUND', 'Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?')
  })

  it('analytics/classes: an unknown classroomId is 403, like a class the teacher does not own', async () => {
    expectError(await (as.guru as Client).get('/api/analytics/classes?classroomId=987654'), 'FORBIDDEN')
  })

  it('class dashboard: unknown and other school give 404, a student caller 403', async () => {
    expectError(await (as.guru as Client).get('/api/performance/classes/987654'), 'NOT_FOUND')
    expectError(await (as.guru as Client).get(`/api/performance/classes/${w.otherClassId}`), 'NOT_FOUND')
    expectError(await (as.pelajar as Client).get(`/api/performance/classes/${w.classId}`), 'FORBIDDEN')
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

  it('an officer gets no question under the minimum cohort and no real pupil name', async () => {
    const r = parseData(await (as.ppd as Client).get(`/api/item-analysis/school/${w.schools.demo1}`), PerformanceSchoolItemAnalysisSchema)
    expect(r.questions.map((q) => q.questionId)).toEqual(['q1'])
    for (const p of wrongPupils(r)) expect(p).toMatchObject({ name: 'Murid', userId: '0' })
    expect(r.tingkatanOptions).toEqual([])
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

  it('a student has no school or level view at all (403), so no teacher list and no top or at-risk pupils', async () => {
    expectError(await (as.pelajar as Client).get('/api/performance/school'), 'FORBIDDEN')
    expectError(await (as.pelajar as Client).get('/api/performance/levels/t4'), 'FORBIDDEN')
  })
})

describe('API-RPT-05 item analysis of the pupil (me)', () => {
  it('a student gets the own analysis: categories over every mode, archived questions dropped, parses with the contract and is no-store', async () => {
    const res = await (as.saya as Client).get('/api/item-analysis/me')
    const r = parseData(res, PerformanceItemAnalysisMeSchema)
    noStore(res)
    // q1: wrong in two modes (Pemulihan); q2: wrong once (Isyarat Awal); q4: right then wrong (Pengukuhan); q3 is archived (no content).
    expect(Object.fromEntries(r.items.map((i) => [i.questionId, i.category]))).toEqual({ q1: 'pemulihan', q4: 'pengukuhan', q2: 'isyarat_awal' })
    expect(r.counts).toEqual({ isyaratAwal: 1, pemulihan: 1, pengukuhan: 1 })
    expect(r.tiles).toMatchObject({ answered: 7, needRemedial: 1, needStrengthen: 1 })
    expect(r.items.find((i) => i.questionId === 'q1')).toMatchObject({ attempts: 2, correct: 0, wrongTimes: 2, explanation: 'Penjelasan q1' })
  })

  it('the query tapis filters the items only; an unknown tapis or an over-long subjectCode is a 422', async () => {
    const s = as.saya as Client
    const wrong = parseData(await s.get('/api/item-analysis/me?tapis=selalu_salah'), PerformanceItemAnalysisMeSchema)
    expect(wrong.items.map((i) => i.questionId)).toEqual(['q1'])
    expect(wrong.counts).toEqual({ isyaratAwal: 1, pemulihan: 1, pengukuhan: 1 })
    const some = parseData(await s.get('/api/item-analysis/me?tapis=ada_betul'), PerformanceItemAnalysisMeSchema)
    expect(some.items.map((i) => i.questionId)).toEqual(['q4'])
    expectError(await s.get('/api/item-analysis/me?tapis=semuanya'), 'VALIDATION_ERROR')
    expectError(await s.get('/api/item-analysis/me?tapis=semua&tapis=ada_betul'), 'VALIDATION_ERROR')
    expectError(await s.get(`/api/item-analysis/me?subjectCode=${'X'.repeat(100)}`), 'VALIDATION_ERROR')
  })

  it('an unknown subjectCode is the empty payload; a pupil with no answers gets zeros', async () => {
    const r = parseData(await (as.saya as Client).get('/api/item-analysis/me?subjectCode=NOPE'), PerformanceItemAnalysisMeSchema)
    expect(r).toEqual({ tiles: { answered: 0, needRemedial: 0, needStrengthen: 0, mastery: null }, subjects: [], counts: { isyaratAwal: 0, pemulihan: 0, pengukuhan: 0 }, items: [] })
    const none = parseData(await (as.pelajarmaju as Client).get('/api/item-analysis/me?subjectCode=NOPE'), PerformanceItemAnalysisMeSchema)
    expect(none.items).toEqual([])
  })

  it('teacher, school admin, admin, officer, parent and sponsor are refused (403)', async () => {
    for (const k of ['guru', 'adminsekolah', 'admin', 'ppd', 'ibubapa', 'penaja'] as const) {
      expectError(await (as[k] as Client).get('/api/item-analysis/me'), 'FORBIDDEN', 'Anda tidak dibenarkan melakukan tindakan ini.')
    }
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
