import {
  PERFORMANCE_HEADCOUNT_MESSAGES,
  PerformanceHeadcountDashboardSchema,
  PerformanceHeadcountDetailSchema,
  PerformanceHeadcountFormOptionsSchema,
  PerformanceHeadcountListItemSchema,
  PerformanceHeadcountStudentSchema,
  PerformanceHeadcountSummarySchema,
} from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { z } from 'zod'

import { type Client, expectCsrfInvalid, expectError, loginAs, parseData } from '../../../curriculum/helpers'
import { bootHeadcountWorld, insertConfig, insertEntry, PUPILS, type HeadcountWorld } from './headcount-boot'

let w: HeadcountWorld
const as: Record<string, Client> = {}
const who = ['guru', 'guru2', 'adminsekolah', 'admin2', 'admin', 'pelajar', 'pelajar2', 'ibubapa'] as const
const MSG = PERFORMANCE_HEADCOUNT_MESSAGES
const UNKNOWN = '987654321'
// requestId is unique per request by design; the privacy assertion is on everything else.
const noReq = (b: unknown): unknown => {
  const c = structuredClone(b) as { error?: { requestId?: unknown } }
  if (c?.error) delete c.error.requestId
  return c
}

beforeAll(async () => {
  w = await bootHeadcountWorld()
  for (const k of who) as[k] = await loginAs(w, `${k}@demo.test`)
}, 180_000)
afterAll(async () => {
  await w?.close()
})

const noStore = (res: { headers: Record<string, unknown> }) => expect(String(res.headers['cache-control'])).toContain('no-store')
const body = (over: Record<string, unknown> = {}) => ({
  classroomId: w.classId,
  subjectId: w.subjectId,
  educationLevelId: w.levelId,
  academicYear: 2026,
  activeOtrs: 3,
  mode: 'auto',
  ...over,
})
const countConfigs = async (): Promise<number> => Number((await w.db.query<{ n: string }>(`select count(*)::text as n from headcount_configs`))[0]?.n)

describe('authentication, roles and CSRF', () => {
  const reads = (): string[] => [
    '/api/headcounts',
    '/api/headcounts/dashboard',
    '/api/headcounts/form-options',
    `/api/headcounts/students/${w.ids['pelajar@demo.test']}`,
    '/api/headcounts/1/summary',
    '/api/headcounts/1',
    '/api/headcounts/1/export',
  ]

  it('answers 401 on all 12 routes without a session', async () => {
    for (const url of reads()) expectError(await w.http().get(url), 'UNAUTHORIZED')
    for (const url of ['/api/headcounts', '/api/headcounts/auto-setup', '/api/headcounts/1/drop-students', '/api/headcounts/1/reset']) {
      expectError(await w.http().post(url).send({}), 'UNAUTHORIZED')
    }
    expectError(await w.http().delete('/api/headcounts/1'), 'UNAUTHORIZED')
  })

  it('a student and a parent get 403 on every route', async () => {
    for (const k of ['pelajar', 'ibubapa']) {
      const c = as[k] as Client
      for (const url of reads()) expectError(await c.get(url), 'FORBIDDEN', 'Anda tidak dibenarkan melakukan tindakan ini.')
      expectError(await c.post('/api/headcounts', body()), 'FORBIDDEN')
      expectError(await c.post('/api/headcounts/auto-setup', { levels: ['T4'] }), 'FORBIDDEN')
      expectError(await c.post('/api/headcounts/1/drop-students', { action: 'drop', studentIds: ['1'] }), 'FORBIDDEN')
      expectError(await c.post('/api/headcounts/1/reset'), 'FORBIDDEN')
      expectError(await c.delete('/api/headcounts/1'), 'FORBIDDEN')
    }
  })

  it('the pupil routes /me and /me/detail: 401 without a session, 403 for staff and a parent, 200 for a pupil', async () => {
    for (const url of ['/api/headcounts/me', '/api/headcounts/me/detail']) {
      expectError(await w.http().get(url), 'UNAUTHORIZED')
      for (const k of ['guru', 'adminsekolah', 'admin', 'ibubapa']) expectError(await (as[k] as Client).get(url), 'FORBIDDEN')
      expect((await (as.pelajar as Client).get(url)).status).toBe(200)
    }
  })

  it('a write without the CSRF token is CSRF_INVALID', async () => {
    const t = as.guru as Client
    for (const tail of ['ar', 'tov', 'settings', 'defaults']) expectCsrfInvalid(await t.noCsrf.put(`/api/headcounts/1/${tail}`, {}))
    expectCsrfInvalid(await t.noCsrf.post('/api/headcounts', body({ academicYear: 2031 })))
    expectCsrfInvalid(await t.noCsrf.post('/api/headcounts/auto-setup', { levels: ['T4'] }))
    expectCsrfInvalid(await t.noCsrf.post('/api/headcounts/1/reset'))
    expectCsrfInvalid(await t.noCsrf.delete('/api/headcounts/1'))
  })
})

describe('create (S14)', () => {
  it('creates a config for an own class: 201 {id}, listed newest first, no-store', async () => {
    const res = await (as.guru as Client).post('/api/headcounts', body({ academicYear: '2030' }))
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    noStore(res)
    const id = parseData(res, z.object({ id: z.string() })).id
    const list = parseData(await (as.guru as Client).get('/api/headcounts'), z.array(PerformanceHeadcountListItemSchema))
    expect(list[0]).toMatchObject({ id, year: 2030, mode: 'auto', activeOtrs: 3 })
    expect(list[0]?.students).toBe(5)
  })

  it('a duplicate (class, subject, year, mode) is 409 with the exact copy; the other mode is allowed', async () => {
    const first = await (as.guru as Client).post('/api/headcounts', body({ academicYear: 2032, mode: 'manual' }))
    expect(first.status).toBe(201)
    const again = await (as.guru as Client).post('/api/headcounts', body({ academicYear: 2032, mode: 'manual' }))
    expectError(again, 'CONFLICT', MSG.duplicate.manual)
    expect((await (as.guru as Client).post('/api/headcounts', body({ academicYear: 2032, mode: 'auto' }))).status).toBe(201)
  })

  it('privacy 12: a foreign class, an unknown class and a non-teacher get the identical 422', async () => {
    const foreign = await (as.guru as Client).post('/api/headcounts', body({ classroomId: w.otherClassId }))
    const unknown = await (as.guru as Client).post('/api/headcounts', body({ classroomId: UNKNOWN }))
    const badId = await (as.guru as Client).post('/api/headcounts', body({ classroomId: 'abc' }))
    for (const res of [foreign, unknown, badId]) {
      const e = expectError(res, 'VALIDATION_ERROR', MSG.classInvalid)
      expect(e.fields).toEqual({ classroomId: MSG.classInvalid })
    }
    expect(noReq(foreign.body)).toEqual(noReq(unknown.body))
    for (const k of ['admin', 'adminsekolah']) {
      expectError(await (as[k] as Client).post('/api/headcounts', body()), 'VALIDATION_ERROR', MSG.classInvalid)
    }
  })

  it('validates every field with the exact copy and reports the first plus the count', async () => {
    const res = await (as.guru as Client).post('/api/headcounts', {
      classroomId: '',
      subjectId: UNKNOWN,
      educationLevelId: '999999',
      academicYear: 1999,
      activeOtrs: 9,
      mode: 'x',
    })
    const e = expectError(res, 'VALIDATION_ERROR')
    expect(e.fields).toMatchObject({
      classroomId: MSG.classInvalid,
      subjectId: MSG.subjectInvalid,
      educationLevelId: MSG.levelInvalid,
      academicYear: MSG.yearInvalid,
      activeOtrs: MSG.otrInvalid,
      mode: MSG.modeInvalid,
    })
    expect(e.message).toBe(`${MSG.classInvalid} (and 5 more errors)`)
    expectError(await (as.guru as Client).post('/api/headcounts', {}), 'VALIDATION_ERROR')
    expect((await (as.guru as Client).post('/api/headcounts', body({ academicYear: 2033, educationLevelId: w.levelId5 }))).status).toBe(201)
  })
})

describe('form options (S14) and auto-setup', () => {
  it('teacher: own active classrooms, active subjects by name, T4 and T5, default year of the clock', async () => {
    const res = await (as.guru as Client).get('/api/headcounts/form-options')
    const o = parseData(res, PerformanceHeadcountFormOptionsSchema)
    expect(o.classes.map((c) => c.id).sort()).toEqual([w.classId, w.classId2].sort())
    expect(o.levels.map((l) => l.id).sort()).toEqual([w.levelId, w.levelId5].sort())
    expect(o.defaultYear).toBe(2026)
    expect(o.subjects.map((s) => s.name)).toEqual([...o.subjects.map((s) => s.name)].sort((a, b) => a.localeCompare(b)))
    expect(parseData(await (as.admin as Client).get('/api/headcounts/form-options'), PerformanceHeadcountFormOptionsSchema).classes).toEqual([])
  })

  it('auto-setup: bad or empty levels are 422; it creates one Auto config of 3 OTRs per own class of the level, once', async () => {
    expectError(await (as.guru as Client).post('/api/headcounts/auto-setup', { levels: [] }), 'VALIDATION_ERROR', MSG.levelsRequired)
    expectError(await (as.guru as Client).post('/api/headcounts/auto-setup', {}), 'VALIDATION_ERROR', MSG.levelsRequired)
    expectError(await (as.guru as Client).post('/api/headcounts/auto-setup', { levels: ['Z9'] }), 'VALIDATION_ERROR', MSG.levelInvalid)
    expectError(await (as.guru as Client).post('/api/headcounts/auto-setup', { levels: ['T6'] }), 'VALIDATION_ERROR', MSG.levelInvalid)
    expectError(await (as.guru as Client).post('/api/headcounts/auto-setup', { levels: ['987654321'] }), 'VALIDATION_ERROR', MSG.levelInvalid)
    const first = await (as.guru as Client).post('/api/headcounts/auto-setup', { levels: ['t4', w.levelId] })
    expect(first.status).toBe(200)
    expect(parseData(first, z.object({ created: z.number() })).created).toBe(2)
    const again = await (as.guru as Client).post('/api/headcounts/auto-setup', { levels: [w.levelId] })
    expect(parseData(again, z.object({ created: z.number() })).created).toBe(0)
    const rows = await w.db.query<{ active_otrs: number; mode: string }>(`select active_otrs, mode from headcount_configs where academic_year = 2026 and classroom_id = $1`, [w.classId])
    expect(rows).toEqual([{ active_otrs: 3, mode: 'auto' }])
  })

  it('create and auto-setup by an admin or a school admin are 403 (S10-T02: writes are the owning teacher\'s)', async () => {
    const before = await countConfigs()
    for (const k of ['admin', 'adminsekolah']) {
      expectError(await (as[k] as Client).post('/api/headcounts/auto-setup', { levels: ['T4'] }), 'FORBIDDEN')
      expectError(await (as[k] as Client).post('/api/headcounts', body({ academicYear: 2060 })), 'FORBIDDEN')
    }
    expect(await countConfigs()).toBe(before)
  })
})

describe('reads of one config', () => {
  let cfg: string
  beforeAll(async () => {
    cfg = await insertConfig(w, { teacher: 'guru@demo.test', classroomId: w.classId, year: 2027, otrs: 2, mode: 'manual' })
    await insertEntry(w, cfg, 'pelajar@demo.test', { tov: 50, etr: 80, rs: 78, marks: [[60, 65], [70, 75]] })
    await insertEntry(w, cfg, PUPILS[0] as string, { tov: 40, marks: [[60, 50], [70, null]] })
    await insertEntry(w, cfg, PUPILS[1] as string, { tov: 99, etr: 99, dropped: true, marks: [[60, 90], [60, 90]] })
  })

  it('summary / detail / dashboard parse, are no-store and agree on live totals (privacy 11)', async () => {
    const t = as.guru as Client
    const summary = await t.get(`/api/headcounts/${cfg}/summary`)
    noStore(summary)
    const s = parseData(summary, PerformanceHeadcountSummarySchema)
    // Roster: pelajar, pelajar2, ujian1..3 (members) = 5 lines; ujian2 is dropped.
    expect(s.students).toBe(4)
    const d = parseData(await t.get(`/api/headcounts/${cfg}`), PerformanceHeadcountDetailSchema)
    expect(d.rows).toHaveLength(5)
    expect(d.rows.find((r) => r.userId === w.ids[PUPILS[1] as string])?.dropped).toBe(true)
    expect(d.chips.total).toBe(s.students)
    expect(d.chips.onTrack + d.chips.below + d.chips.empty).toBe(d.chips.total)
    expect(d.averages.tov).toBe(45)
    const dash = parseData(await t.get('/api/headcounts/dashboard'), PerformanceHeadcountDashboardSchema)
    const mine = dash.configs.find((c) => c.id === cfg)
    expect(mine?.totalStudents).toBe(s.students)
    expect((mine?.onTrack ?? 0) + (mine?.offTrack ?? 0) + (mine?.noData ?? 0)).toBe(s.students)
  })

  it('detail sorts by ranking and by name; export is a CSV attachment with a BOM', async () => {
    const t = as.guru as Client
    const byName = parseData(await t.get(`/api/headcounts/${cfg}?sort=name`), PerformanceHeadcountDetailSchema)
    const names = byName.rows.map((r) => r.name)
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)))
    const ranked = parseData(await t.get(`/api/headcounts/${cfg}?sort=zzz`), PerformanceHeadcountDetailSchema)
    // A dropped pupil keeps its place in the detail; the best live pupil is pelajar.
    expect(ranked.rows.filter((r) => !r.dropped)[0]?.userId).toBe(w.ids['pelajar@demo.test'])
    const res = await t.get(`/api/headcounts/${cfg}/export`)
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('text/csv')
    expect(res.headers['content-disposition']).toContain(`filename="headcount-${cfg}.csv"`)
    noStore(res)
    const text = res.text
    expect(text.charCodeAt(0)).toBe(0xfeff)
    expect(text).toContain('Purata Kelas')
    expect(text).not.toContain('Murid Ujian 2')
  })

  it('CSV injection: a pupil name starting with = is exported with a leading apostrophe', async () => {
    await w.db.query(`update users set name = '=1+1' where email = $1`, [PUPILS[2]])
    const res = await (as.guru as Client).get(`/api/headcounts/${cfg}/export`)
    const text = res.text
    expect(text).toContain(",'=1+1,")
    expect(text).not.toMatch(/,=1\+1,/)
    await w.db.query(`update users set name = 'Murid Ujian 3' where email = $1`, [PUPILS[2]])
  })

  it('a school admin of the class school and an admin read it; students/{userId} lists the section', async () => {
    for (const k of ['adminsekolah', 'admin']) parseData(await (as[k] as Client).get(`/api/headcounts/${cfg}/summary`), PerformanceHeadcountSummarySchema)
    const s = parseData(await (as.guru as Client).get(`/api/headcounts/students/${w.ids['pelajar@demo.test']}`), PerformanceHeadcountStudentSchema)
    const sec = s.sections.find((x) => x.configId === cfg)
    // TOV 50, ETR 80, n = 2: OTR1 = 65 (AR 65 on), OTR2 = 80 (AR 75 below); the status is the latest checkpoint's.
    expect(sec).toMatchObject({ status: 'below', tov: 50, etr: 80, mode: 'manual', entryStatus: 'active' })
    expect(sec?.rows.map((r) => r.target)).toEqual([65, 80])
    expect(sec?.prediction).toMatchObject({ diff: -2, verdict: 'Ramalan Tepat' })
    expect(sec?.rows).toHaveLength(2)
  })

  it('a dropped pupil has no section', async () => {
    const s = parseData(await (as.guru as Client).get(`/api/headcounts/students/${w.ids[PUPILS[1] as string]}`), PerformanceHeadcountStudentSchema)
    expect(s.sections.find((x) => x.configId === cfg)).toBeUndefined()
  })
})

describe('privacy 9 and 10: one 404 for unknown and not visible', () => {
  let cfg: string
  beforeAll(async () => {
    cfg = await insertConfig(w, { teacher: 'guru@demo.test', classroomId: w.classId, year: 2028, otrs: 2 })
    await insertEntry(w, cfg, 'pelajar@demo.test', { tov: 61, marks: [[60, 65], [70, 75]] })
  })

  const calls: [string, (c: Client, id: string) => ReturnType<Client['get']>][] = [
    ['summary', (c, id) => c.get(`/api/headcounts/${id}/summary`)],
    ['detail', (c, id) => c.get(`/api/headcounts/${id}`)],
    ['export', (c, id) => c.get(`/api/headcounts/${id}/export`)],
    ['drop-students', (c, id) => c.post(`/api/headcounts/${id}/drop-students`, { action: 'drop', studentIds: [w.ids['pelajar@demo.test']] })],
    ['reset', (c, id) => c.post(`/api/headcounts/${id}/reset`)],
    ['delete', (c, id) => c.delete(`/api/headcounts/${id}`)],
  ]

  it.each(calls)('%s: a foreign teacher, a foreign school admin and an unknown id get the identical 404', async (_name, call) => {
    const unknown = await call(as.guru as Client, UNKNOWN)
    expectError(unknown, 'NOT_FOUND', 'Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?')
    for (const k of ['guru2', 'admin2']) {
      const res = await call(as[k] as Client, cfg)
      expect(res.status).toBe(unknown.status)
      expect(noReq(res.body)).toEqual(noReq(unknown.body))
    }
  })

  it('the refused writes changed nothing', async () => {
    const d = parseData(await (as.guru as Client).get(`/api/headcounts/${cfg}`), PerformanceHeadcountDetailSchema)
    expect(d.rows.find((r) => r.userId === w.ids['pelajar@demo.test'])).toMatchObject({ tov: 61, dropped: false })
  })

  it('students/{userId} never shows a foreign config, and unknown, non-student and foreign pupils are the same 404', async () => {
    const unknown = await (as.guru2 as Client).get(`/api/headcounts/students/${UNKNOWN}`)
    expectError(unknown, 'NOT_FOUND')
    // ujian1 is a member of guru2's class, but the section of guru's config is not guru2's.
    const own = parseData(await (as.guru2 as Client).get(`/api/headcounts/students/${w.ids[PUPILS[0] as string]}`), PerformanceHeadcountStudentSchema)
    expect(own.sections.every((s) => s.configId !== cfg)).toBe(true)
    // pelajar is in none of guru2's classes.
    const notMine = await (as.guru2 as Client).get(`/api/headcounts/students/${w.ids['pelajar@demo.test']}`)
    expect(notMine.status).toBe(unknown.status)
    expect(noReq(notMine.body)).toEqual(noReq(unknown.body))
    // a teacher account is not a student; a pupil of another school is out of a school admin's scope.
    const teacher = await (as.admin as Client).get(`/api/headcounts/students/${w.ids['guru@demo.test']}`)
    expect(teacher.status).toBe(404)
    const otherSchool = await (as.adminsekolah as Client).get(`/api/headcounts/students/${w.ids['ujian9@demo.test']}`)
    expect(otherSchool.status).toBe(404)
    expect(noReq(otherSchool.body)).toEqual(noReq(unknown.body))
    // the school admin of the OTHER school cannot see the pupil of DEMO001 either.
    const fromOther = await (as.admin2 as Client).get(`/api/headcounts/students/${w.ids['pelajar@demo.test']}`)
    expect(noReq(fromOther.body)).toEqual(noReq(unknown.body))
  })

  it('list and dashboard: a teacher sees own configs, a school admin the own school, an admin all; the "Guru" name is listed', async () => {
    const list = async (k: string) => parseData(await (as[k] as Client).get('/api/headcounts'), z.array(PerformanceHeadcountListItemSchema))
    const mine = await list('guru')
    expect(mine.some((c) => c.id === cfg)).toBe(true)
    expect(mine.every((c) => c.teacherName !== '')).toBe(true)
    expect(await list('guru2')).toEqual([])
    expect((await list('adminsekolah')).some((c) => c.id === cfg)).toBe(true)
    expect((await list('admin2')).some((c) => c.id === cfg)).toBe(false)
    expect((await list('admin')).some((c) => c.id === cfg)).toBe(true)
    const dash = async (k: string) => parseData(await (as[k] as Client).get('/api/headcounts/dashboard'), PerformanceHeadcountDashboardSchema).configs
    expect((await dash('adminsekolah')).some((c) => c.id === cfg)).toBe(true)
    expect((await dash('admin2')).some((c) => c.id === cfg)).toBe(false)
    expect((await dash('admin')).some((c) => c.id === cfg)).toBe(true)
  })

  it('a school admin or admin who can see the config is 403 on every write; another school\'s admin gets the 404', async () => {
    const writes: [string, (c: Client) => ReturnType<Client['get']>][] = [
      ['ar', (c) => c.put(`/api/headcounts/${cfg}/ar`, { checkpoint: 1, marks: [] })],
      ['tov', (c) => c.put(`/api/headcounts/${cfg}/tov`, { rows: [] })],
      ['settings', (c) => c.put(`/api/headcounts/${cfg}/settings`, { activeOtrs: 2 })],
      ['defaults', (c) => c.put(`/api/headcounts/${cfg}/defaults`, { defaultTov: 1, defaultEtr: 2 })],
      ['drop', (c) => c.post(`/api/headcounts/${cfg}/drop-students`, { action: 'drop', studentIds: [w.ids['pelajar@demo.test']] })],
      ['reset', (c) => c.post(`/api/headcounts/${cfg}/reset`)],
      ['delete', (c) => c.delete(`/api/headcounts/${cfg}`)],
    ]
    for (const [, call] of writes) {
      for (const k of ['adminsekolah', 'admin']) expectError(await call(as[k] as Client), 'FORBIDDEN')
      for (const k of ['guru2', 'admin2']) expectError(await call(as[k] as Client), 'NOT_FOUND')
    }
    const d = parseData(await (as.guru as Client).get(`/api/headcounts/${cfg}`), PerformanceHeadcountDetailSchema)
    expect(d.rows.find((r) => r.userId === w.ids['pelajar@demo.test'])).toMatchObject({ tov: 61, dropped: false })
  })
})

describe('S10-T02: Key-in AR, Edit TOV/ETR, Tetapan, Simpan Sasaran', () => {
  let manual: string
  let auto: string
  const pelajar = (): string => w.ids['pelajar@demo.test'] as string
  const row = (d: z.infer<typeof PerformanceHeadcountDetailSchema>, id: string) => d.rows.find((r) => r.userId === id)
  beforeAll(async () => {
    manual = await insertConfig(w, { teacher: 'guru@demo.test', classroomId: w.classId, year: 2050, otrs: 3, mode: 'manual' })
    auto = await insertConfig(w, { teacher: 'guru@demo.test', classroomId: w.classId, year: 2050, otrs: 3, mode: 'auto' })
  })

  it('PUT /tov and /defaults answer the updated detail with computed OTR targets (TOV 40, ETR 80 gives 53 / 66 / 80)', async () => {
    const t = as.guru as Client
    const d = parseData(await t.put(`/api/headcounts/${manual}/tov`, { rows: [{ userId: pelajar(), tov: 40, etr: 80 }] }), PerformanceHeadcountDetailSchema)
    expect(row(d, pelajar())?.cells.map((c) => c.target)).toEqual([53, 66, 80])
    const dd = parseData(await t.put(`/api/headcounts/${manual}/defaults`, { defaultTov: 30, defaultEtr: 60 }), PerformanceHeadcountDetailSchema)
    expect(dd.config).toMatchObject({ defaultTov: 30, defaultEtr: 60, mode: 'manual' })
    // an entry with its own values keeps them; one without reads the default
    expect(row(dd, pelajar())).toMatchObject({ tov: 40, etr: 80 })
    expect(row(dd, w.ids[PUPILS[0] as string] as string)).toMatchObject({ tov: 30, etr: 60, entryStatus: 'active' })
    expectError(await t.put(`/api/headcounts/${manual}/defaults`, { defaultTov: 101, defaultEtr: null }), 'VALIDATION_ERROR', MSG.markRange)
  })

  it('PUT /ar keeps one decimal, validates 0..100, and is 404 on an Auto config or a checkpoint beyond the OTR count', async () => {
    const t = as.guru as Client
    const ok = parseData(await t.put(`/api/headcounts/${manual}/ar`, { checkpoint: 1, marks: [{ userId: pelajar(), value: 66.5 }] }), PerformanceHeadcountDetailSchema)
    expect(row(ok, pelajar())?.cells[0]?.ar).toBe(66.5)
    const bad = expectError(await t.put(`/api/headcounts/${manual}/ar`, { checkpoint: 1, marks: [{ userId: pelajar(), value: 101 }] }), 'VALIDATION_ERROR', MSG.markRange)
    expect(bad.fields).toEqual({ 'marks.0.value': MSG.markRange })
    expectError(await t.put(`/api/headcounts/${manual}/ar`, { checkpoint: 4, marks: [] }), 'NOT_FOUND')
    expectError(await t.put(`/api/headcounts/${auto}/ar`, { checkpoint: 1, marks: [] }), 'NOT_FOUND')
    expectError(await t.put(`/api/headcounts/${manual}/ar`, { checkpoint: 1, marks: [{ userId: w.ids['ujian9@demo.test'], value: 50 }] }), 'VALIDATION_ERROR', MSG.studentsInvalid)
    const stored = await w.db.query<{ actual: string }>(`select m.actual::text from headcount_entry_marks m join headcount_entries e on e.id = m.entry_id where e.config_id = $1 and m.checkpoint = 1`, [manual])
    expect(stored.map((r) => Number(r.actual))).toEqual([66.5])
  })

  it('RS: the date defaults to today (MYT) on the first save, a future date is 422, rs null clears the date', async () => {
    const t = as.guru as Client
    const first = parseData(await t.put(`/api/headcounts/${manual}/tov`, { rows: [{ userId: pelajar(), rs: 78 }] }), PerformanceHeadcountDetailSchema)
    expect(row(first, pelajar())).toMatchObject({ rs: 78, rsRecordedAt: '2026-10-19' })
    expectError(await t.put(`/api/headcounts/${manual}/tov`, { rows: [{ userId: pelajar(), rs: 79, rsRecordedAt: '2026-10-20' }] }), 'VALIDATION_ERROR', MSG.rsDateFuture)
    const cleared = parseData(await t.put(`/api/headcounts/${manual}/tov`, { rows: [{ userId: pelajar(), rs: null }] }), PerformanceHeadcountDetailSchema)
    expect(row(cleared, pelajar())).toMatchObject({ rs: null, rsRecordedAt: null })
  })

  it('CF-05: lowering below a checkpoint with marks is 409 until confirmed, then the marks above go in the same save', async () => {
    const t = as.guru as Client
    await t.put(`/api/headcounts/${manual}/ar`, { checkpoint: 3, marks: [{ userId: pelajar(), value: 70 }] })
    const err = expectError(await t.put(`/api/headcounts/${manual}/settings`, { activeOtrs: 2 }), 'CONFLICT')
    expect(err.message).toBe('OTR3 ke atas mempunyai markah. Padam markah tersebut?')
    expect((await w.db.query<{ active_otrs: number }>(`select active_otrs from headcount_configs where id = $1`, [manual]))[0]?.active_otrs).toBe(3)
    const d = parseData(await t.put(`/api/headcounts/${manual}/settings`, { activeOtrs: 2, confirm: true }), PerformanceHeadcountDetailSchema)
    expect(d.config.activeOtrs).toBe(2)
    expect(await w.db.query(`select 1 from headcount_entry_marks m join headcount_entries e on e.id = m.entry_id where e.config_id = $1 and m.checkpoint > 2`, [manual])).toHaveLength(0)
    expect(await w.db.query(`select 1 from audit_events where action = 'headcount.config.otrs_changed' and target_id = $1`, [manual])).toHaveLength(1)
    expectError(await t.put(`/api/headcounts/${manual}/settings`, { activeOtrs: 6 }), 'VALIDATION_ERROR', MSG.otrInvalid)
  })
})

describe('S10-T02: the pupil\'s own view', () => {
  let cfg: string
  let foreign: string
  beforeAll(async () => {
    cfg = await insertConfig(w, { teacher: 'guru@demo.test', classroomId: w.classId, year: 2026, otrs: 2, mode: 'manual', subjectId: w.subjectId2 })
    await insertEntry(w, cfg, 'pelajar@demo.test', { tov: 40, etr: 80, marks: [[null, 60], [null, null]] })
    await insertEntry(w, cfg, 'pelajar2@demo.test', { tov: 10, etr: 20, marks: [[null, 99]] })
    // a class pupil@demo is not in
    foreign = await insertConfig(w, { teacher: 'guru2@demo.test', classroomId: w.otherClassId, year: 2026, otrs: 2, mode: 'manual' })
  })

  it('lists the configs of the own classes of the current year by membership; never another class', async () => {
    const list = parseData(await (as.pelajar as Client).get('/api/headcounts/me'), z.array(PerformanceHeadcountListItemSchema))
    expect(list.some((c) => c.id === cfg)).toBe(true)
    expect(list.some((c) => c.id === foreign)).toBe(false)
    expect(list.every((c) => c.year === 2026)).toBe(true)
    expect(list.find((c) => c.id === cfg)).toMatchObject({ entryStatus: 'active', statusReason: null, mode: 'manual' })
  })

  it('detail is the own line only; a foreign or unknown configId is 404; staff ids are never reachable', async () => {
    const d = parseData(await (as.pelajar as Client).get(`/api/headcounts/me/detail?configId=${cfg}`), PerformanceHeadcountStudentSchema)
    expect(d.student.id).toBe(w.ids['pelajar@demo.test'])
    expect(d.sections).toHaveLength(1)
    // OTR1 = round(40 + 40 * 0.5) = 60 for n = 2; AR1 60 reaches it.
    expect(d.sections[0]).toMatchObject({ configId: cfg, tov: 40, etr: 80, status: 'on', jurang: 40 })
    expect(JSON.stringify(d)).not.toContain('Murid Ujian')
    expectError(await (as.pelajar as Client).get(`/api/headcounts/me/detail?configId=${foreign}`), 'NOT_FOUND')
    expectError(await (as.pelajar as Client).get(`/api/headcounts/me/detail?configId=${UNKNOWN}`), 'NOT_FOUND')
    expectError(await (as.pelajar as Client).get(`/api/headcounts/students/${w.ids['pelajar@demo.test']}`), 'FORBIDDEN')
  })

  it('a pupil dropped from the config does not see it', async () => {
    await (as.guru as Client).post(`/api/headcounts/${cfg}/drop-students`, { action: 'drop', studentIds: [w.ids['pelajar2@demo.test']] })
    const list = parseData(await (as.pelajar2 as Client).get('/api/headcounts/me'), z.array(PerformanceHeadcountListItemSchema))
    expect(list.some((c) => c.id === cfg)).toBe(false)
  })
})

describe('drop, reset and delete', () => {
  it('drop validates, drops a pupil without an entry (creating an empty dropped entry) and restores', async () => {
    const cfg = await insertConfig(w, { teacher: 'guru@demo.test', classroomId: w.classId, year: 2029, otrs: 2 })
    const t = as.guru as Client
    const url = `/api/headcounts/${cfg}/drop-students`
    expectError(await t.post(url, { action: 'x', studentIds: [] }), 'VALIDATION_ERROR')
    const empty = expectError(await t.post(url, { action: 'drop', studentIds: [] }), 'VALIDATION_ERROR', MSG.studentsRequired)
    expect(empty.fields).toEqual({ studentIds: MSG.studentsRequired })
    const bad = await t.post(url, { action: 'foo', studentIds: [w.ids['ujian9@demo.test']] })
    expect(expectError(bad, 'VALIDATION_ERROR').fields).toEqual({ action: MSG.actionInvalid, studentIds: MSG.studentsInvalid })
    // A pupil of another school and a nonexistent id give the same message.
    const foreign = await t.post(url, { action: 'drop', studentIds: [w.ids['ujian9@demo.test']] })
    const missing = await t.post(url, { action: 'drop', studentIds: [UNKNOWN] })
    expectError(foreign, 'VALIDATION_ERROR', MSG.studentsInvalid)
    expect(noReq(foreign.body)).toEqual(noReq(missing.body))

    const pupil = w.ids['pelajar2@demo.test']
    const dropped = await t.post(url, { action: 'drop', studentIds: [pupil, pupil] })
    expect(parseData(dropped, z.object({ updated: z.number() })).updated).toBe(1)
    let d = parseData(await t.get(`/api/headcounts/${cfg}`), PerformanceHeadcountDetailSchema)
    expect(d.rows.find((r) => r.userId === pupil)?.dropped).toBe(true)
    const restored = await t.post(url, { action: 'restore', studentIds: [pupil] })
    expect(parseData(restored, z.object({ updated: z.number() })).updated).toBe(1)
    d = parseData(await t.get(`/api/headcounts/${cfg}`), PerformanceHeadcountDetailSchema)
    expect(d.rows.find((r) => r.userId === pupil)?.dropped).toBe(false)
  })

  it('reset clears the marks and keeps the roster; it is audited without pupil data', async () => {
    const cfg = await insertConfig(w, { teacher: 'guru@demo.test', classroomId: w.classId, year: 2034, otrs: 2 })
    await insertEntry(w, cfg, 'pelajar@demo.test', { tov: 50, etr: 80, rs: 70, marks: [[60, 65], [70, 75]] })
    const res = await (as.guru as Client).post(`/api/headcounts/${cfg}/reset`)
    expect(res.body).toEqual({ data: { reset: true } })
    const d = parseData(await (as.guru as Client).get(`/api/headcounts/${cfg}`), PerformanceHeadcountDetailSchema)
    expect(d.rows).toHaveLength(5)
    expect(d.rows.every((r) => r.tov === null && r.etr === null && r.cells.every((c) => c.target === null && c.ar === null))).toBe(true)
    const audit = await w.db.query<{ detail: unknown }>(`select detail from audit_events where action = 'headcount.config.reset' and target_id = $1`, [cfg])
    expect(audit).toHaveLength(1)
    expect(Object.keys(audit[0]?.detail as object).sort()).toEqual(['configId', 'entries', 'sessionRowId'])
  })

  it('delete removes the config, its entries and marks; it is audited; a second delete is 404', async () => {
    const cfg = await insertConfig(w, { teacher: 'guru@demo.test', classroomId: w.classId, year: 2035, otrs: 2 })
    const entry = await insertEntry(w, cfg, 'pelajar@demo.test', { tov: 50, marks: [[60, 65]] })
    const res = await (as.guru as Client).delete(`/api/headcounts/${cfg}`)
    expect(res.body).toEqual({ data: { deleted: true } })
    expect(await w.db.query(`select 1 from headcount_entries where config_id = $1`, [cfg])).toHaveLength(0)
    expect(await w.db.query(`select 1 from headcount_entry_marks where entry_id = $1`, [entry])).toHaveLength(0)
    expect(await w.db.query(`select 1 from audit_events where action = 'headcount.config.deleted' and target_id = $1`, [cfg])).toHaveLength(1)
    expectError(await (as.guru as Client).delete(`/api/headcounts/${cfg}`), 'NOT_FOUND')
    expect(await countConfigs()).toBeGreaterThan(0)
  })
})
