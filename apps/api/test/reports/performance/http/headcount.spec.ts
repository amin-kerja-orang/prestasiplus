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
const who = ['guru', 'guru2', 'adminsekolah', 'admin2', 'admin', 'pelajar', 'ibubapa'] as const
const MSG = PERFORMANCE_HEADCOUNT_MESSAGES
const UNKNOWN = '987654321'

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
      for (const url of reads()) expectError(await c.get(url), 'FORBIDDEN', 'This action is unauthorized.')
      expectError(await c.post('/api/headcounts', body()), 'FORBIDDEN')
      expectError(await c.post('/api/headcounts/auto-setup', { levels: ['T4'] }), 'FORBIDDEN')
      expectError(await c.post('/api/headcounts/1/drop-students', { action: 'drop', studentIds: ['1'] }), 'FORBIDDEN')
      expectError(await c.post('/api/headcounts/1/reset'), 'FORBIDDEN')
      expectError(await c.delete('/api/headcounts/1'), 'FORBIDDEN')
    }
  })

  it('a write without the CSRF token is CSRF_INVALID', async () => {
    const t = as.guru as Client
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
    expect(foreign.body).toEqual(unknown.body)
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

  it('auto-setup by an admin or a school admin creates nothing', async () => {
    for (const k of ['admin', 'adminsekolah']) {
      const res = await (as[k] as Client).post('/api/headcounts/auto-setup', { levels: ['T4'] })
      expect(parseData(res, z.object({ created: z.number() })).created).toBe(0)
    }
  })
})

describe('reads of one config', () => {
  let cfg: string
  beforeAll(async () => {
    cfg = await insertConfig(w, { teacher: 'guru@demo.test', classroomId: w.classId, year: 2027, otrs: 2 })
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
    expect(sec).toMatchObject({ status: 'on', tov: 50, etr: 80 })
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
    expectError(unknown, 'NOT_FOUND', 'Not Found.')
    for (const k of ['guru2', 'admin2']) {
      const res = await call(as[k] as Client, cfg)
      expect(res.status).toBe(unknown.status)
      expect(res.body).toEqual(unknown.body)
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
    expect(notMine.body).toEqual(unknown.body)
    // a teacher account is not a student; a pupil of another school is out of a school admin's scope.
    const teacher = await (as.admin as Client).get(`/api/headcounts/students/${w.ids['guru@demo.test']}`)
    expect(teacher.status).toBe(404)
    const otherSchool = await (as.adminsekolah as Client).get(`/api/headcounts/students/${w.ids['ujian9@demo.test']}`)
    expect(otherSchool.status).toBe(404)
    expect(otherSchool.body).toEqual(unknown.body)
    // the school admin of the OTHER school cannot see the pupil of DEMO001 either.
    const fromOther = await (as.admin2 as Client).get(`/api/headcounts/students/${w.ids['pelajar@demo.test']}`)
    expect(fromOther.body).toEqual(unknown.body)
  })

  it('list and dashboard: a teacher sees only own configs; admin and school admin get empty ones', async () => {
    const mine = parseData(await (as.guru as Client).get('/api/headcounts'), z.array(PerformanceHeadcountListItemSchema))
    expect(mine.some((c) => c.id === cfg)).toBe(true)
    expect(parseData(await (as.guru2 as Client).get('/api/headcounts'), z.array(PerformanceHeadcountListItemSchema))).toEqual([])
    for (const k of ['admin', 'adminsekolah']) {
      expect(parseData(await (as[k] as Client).get('/api/headcounts'), z.array(PerformanceHeadcountListItemSchema))).toEqual([])
      expect(parseData(await (as[k] as Client).get('/api/headcounts/dashboard'), PerformanceHeadcountDashboardSchema).configs).toEqual([])
    }
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
    expect(foreign.body).toEqual(missing.body)

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
    expect(Object.keys(audit[0]?.detail as object).sort()).toEqual(['configId', 'entries'])
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
