import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { z } from 'zod'

import { type Client, expectError, loginAs, parseData } from '../../../curriculum/helpers'
import { bootHeadcountWorld, insertConfig, type HeadcountWorld } from './headcount-boot'

let w: HeadcountWorld
const as: Record<string, Client> = {}
const who = ['guru', 'guru2', 'admin', 'pelajar'] as const
const UNKNOWN = '987654321'

beforeAll(async () => {
  w = await bootHeadcountWorld()
  for (const k of who) as[k] = await loginAs(w, `${k}@demo.test`)
}, 180_000)
afterAll(async () => {
  await w?.close()
})

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

describe('audit of create, auto-setup and drop-students (AM-13)', () => {
  type Row = { action: string; actor_user_id: string; target_type: string | null; target_id: string | null; school_id: string | null; detail: Record<string, unknown> }
  const rowsOf = (action: string): Promise<Row[]> =>
    w.db.query<Row>(
      `select action, actor_user_id::text, target_type, target_id::text, scope_school_id::text as school_id, detail from audit_events where action = $1 order by id`,
      [action],
    )
  const countAudit = async (like: string): Promise<number> =>
    Number((await w.db.query<{ n: string }>(`select count(*)::text as n from audit_events where action like $1`, [like]))[0]?.n)

  it('create writes exactly one row: actor from the session, target is the new config, counts and ids only', async () => {
    const before = (await rowsOf('headcount.config.created')).length
    const res = await (as.guru as Client).post('/api/headcounts', body({ academicYear: 2041, mode: 'manual' }))
    expect(res.status).toBe(201)
    const id = parseData(res, z.object({ id: z.string() })).id
    const rows = (await rowsOf('headcount.config.created')).filter((r) => r.target_id === id)
    expect((await rowsOf('headcount.config.created')).length).toBe(before + 1)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.actor_user_id).toBe(w.ids['guru@demo.test'])
    expect(rows[0]?.target_type).toBe('headcount_config')
    expect(rows[0]?.school_id).not.toBeNull()
    expect(rows[0]?.detail).toMatchObject({ configId: id, classroomId: w.classId, subjectId: w.subjectId, academicYear: 2041 })
    expect(JSON.stringify(rows[0]?.detail)).not.toMatch(/pelajar|@demo\.test/)
  })

  it('a refused create (422, 403, duplicate 409) writes no row', async () => {
    const before = await countAudit('headcount.config.created')
    expectError(await (as.guru as Client).post('/api/headcounts', {}), 'VALIDATION_ERROR')
    expectError(await (as.pelajar as Client).post('/api/headcounts', body({ academicYear: 2042 })), 'FORBIDDEN')
    expectError(await (as.guru as Client).post('/api/headcounts', body({ academicYear: 2041, mode: 'manual' })), 'CONFLICT')
    expect(await countAudit('headcount.config.created')).toBe(before)
  })

  it('a create whose audit insert fails rolls the config back', async () => {
    await w.db.query(`create or replace function pp_fail_audit() returns trigger language plpgsql as $$ begin raise exception 'audit down'; end $$`)
    await w.db.query(`create trigger pp_fail_audit before insert on audit_events for each row when (new.action = 'headcount.config.created') execute function pp_fail_audit()`)
    try {
      const n = await countConfigs()
      const res = await (as.guru as Client).post('/api/headcounts', body({ academicYear: 2043, mode: 'manual' }))
      expect(res.status).toBe(500)
      expect(await countConfigs()).toBe(n)
    } finally {
      await w.db.query(`drop trigger pp_fail_audit on audit_events`)
    }
  })

  const failingAudit = async (action: string, run: () => Promise<void>): Promise<void> => {
    await w.db.query(`create or replace function pp_fail_audit() returns trigger language plpgsql as $$ begin raise exception 'audit down'; end $$`)
    await w.db.query(`create trigger pp_fail_audit before insert on audit_events for each row when (new.action = '${action}') execute function pp_fail_audit()`)
    try {
      await run()
    } finally {
      await w.db.query(`drop trigger pp_fail_audit on audit_events`)
    }
  }

  it('an auto-setup whose audit insert fails rolls every config back', async () => {
    const n = await countConfigs()
    const rows = await countAudit('headcount.configs.auto_setup')
    await failingAudit('headcount.configs.auto_setup', async () => {
      const res = await (as.guru as Client).post('/api/headcounts/auto-setup', { levels: ['t4', w.levelId] })
      expect(res.status).toBe(500)
    })
    expect(await countConfigs()).toBe(n)
    expect(await countAudit('headcount.configs.auto_setup')).toBe(rows)
  })

  it('auto-setup that creates configs writes exactly one row with the count only', async () => {
    const rowsBefore = await rowsOf('headcount.configs.auto_setup')
    const before = await countConfigs()
    const first = await (as.guru as Client).post('/api/headcounts/auto-setup', { levels: ['t4', w.levelId] })
    const created = parseData(first, z.object({ created: z.number() })).created
    expect(created).toBeGreaterThan(0)
    expect(await countConfigs()).toBe(before + created)
    const after = await rowsOf('headcount.configs.auto_setup')
    expect(after).toHaveLength(rowsBefore.length + 1)
    const row = after[after.length - 1] as Row
    expect(row.actor_user_id).toBe(w.ids['guru@demo.test'])
    expect(row.target_type).toBe('headcount_config')
    expect(row.target_id).toBeNull()
    expect(row.detail).toMatchObject({ created })
    expect(Object.keys(row.detail).sort()).toEqual(['created', 'sessionRowId'])
  })

  it('auto-setup: idempotent re-run, validation, role and non-teacher refusals write no row', async () => {
    await (as.guru as Client).post('/api/headcounts/auto-setup', { levels: ['t4'] })
    const before = await countAudit('headcount.configs.auto_setup')
    const again = await (as.guru as Client).post('/api/headcounts/auto-setup', { levels: ['t4'] })
    expect(parseData(again, z.object({ created: z.number() })).created).toBe(0)
    expectError(await (as.guru as Client).post('/api/headcounts/auto-setup', { levels: [] }), 'VALIDATION_ERROR')
    expectError(await (as.pelajar as Client).post('/api/headcounts/auto-setup', { levels: ['T4'] }), 'FORBIDDEN')
    await (as.admin as Client).post('/api/headcounts/auto-setup', { levels: ['T4'] })
    expect(await countAudit('headcount.configs.auto_setup')).toBe(before)
  })

  it('drop-students writes one row per call with the count, never the pupil ids; refusals write none', async () => {
    const cfg = await insertConfig(w, { teacher: 'guru@demo.test', classroomId: w.classId, year: 2044, otrs: 2 })
    const t = as.guru as Client
    const url = `/api/headcounts/${cfg}/drop-students`
    const pupil = w.ids['pelajar2@demo.test'] as string
    expectError(await t.post(url, { action: 'drop', studentIds: [UNKNOWN] }), 'VALIDATION_ERROR')
    expectError(await (as.guru2 as Client).post(url, { action: 'drop', studentIds: [pupil] }), 'NOT_FOUND')
    expectError(await (as.pelajar as Client).post(url, { action: 'drop', studentIds: [pupil] }), 'FORBIDDEN')
    expect((await rowsOf('headcount.students.dropped')).filter((r) => r.target_id === cfg)).toHaveLength(0)

    expect((await t.post(url, { action: 'drop', studentIds: [pupil, pupil] })).status).toBe(200)
    const rows = (await rowsOf('headcount.students.dropped')).filter((r) => r.target_id === cfg)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.actor_user_id).toBe(w.ids['guru@demo.test'])
    expect(rows[0]?.target_type).toBe('headcount_config')
    expect(rows[0]?.school_id).not.toBeNull()
    expect(rows[0]?.detail).toMatchObject({ configId: cfg, action: 'drop', dropped: 1 })
    expect(Object.keys(rows[0]?.detail ?? {}).sort()).toEqual(['action', 'configId', 'dropped', 'sessionRowId'])
    await t.post(url, { action: 'restore', studentIds: [pupil] })
    const all = (await rowsOf('headcount.students.dropped')).filter((r) => r.target_id === cfg)
    expect(all).toHaveLength(2)
    expect(all[1]?.detail).toMatchObject({ action: 'restore', restored: 1 })
  })

  it('a drop whose audit insert fails leaves the pupil undropped', async () => {
    const cfg = await insertConfig(w, { teacher: 'guru@demo.test', classroomId: w.classId, year: 2045, otrs: 2 })
    const pupil = w.ids['pelajar2@demo.test'] as string
    const dropped = async (): Promise<number> =>
      Number((await w.db.query<{ n: string }>(`select count(*)::text as n from headcount_entries where config_id = $1 and dropped`, [cfg]))[0]?.n)
    await failingAudit('headcount.students.dropped', async () => {
      const res = await (as.guru as Client).post(`/api/headcounts/${cfg}/drop-students`, { action: 'drop', studentIds: [pupil] })
      expect(res.status).toBe(500)
    })
    expect(await dropped()).toBe(0)
    expect((await rowsOf('headcount.students.dropped')).filter((r) => r.target_id === cfg)).toHaveLength(0)
  })
})
