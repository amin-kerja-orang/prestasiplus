import {
  PracticeReadSpmTargetsSaveResponseSchema,
  PracticeReadSpmTargetsSchema,
  PRACTICE_READS_SPM_GRADES,
  envelopeOf,
} from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { SPM_TARGET_SUBJECT_CODES } from '../../../src/modules/practice/reads/writes/rules'
import {
  type Client,
  type WritesTestApp,
  bootWritesApp,
  expectCsrfInvalid,
  expectError,
  loginAs,
  loginModPelajar,
  subjectIdOf,
  userIdOf,
} from './helpers'

const Envelope = envelopeOf(PracticeReadSpmTargetsSchema)

let t: WritesTestApp
const ids: Record<string, string> = {}
let order: string[] = []

beforeAll(async () => {
  t = await bootWritesApp()
  for (const code of SPM_TARGET_SUBJECT_CODES) ids[code] = await subjectIdOf(t.db, code)
  order = SPM_TARGET_SUBJECT_CODES.map((c) => ids[c] as string)
}, 120_000)

afterAll(async () => {
  await t.close()
})

const targetsOf = async (c: Client): Promise<Record<string, string>> => {
  const res = await c.get('/api/spm-targets')
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  return Object.fromEntries(Envelope.parse(res.body).data.subjects.flatMap((s) => (s.target !== null ? [[s.id, s.target] as const] : [])))
}

const rowsOf = async (userId: string) =>
  t.db.query<{ subject_id: string; target_grade: string; is_test: boolean; created_at: string; updated_at: string; id: string }>(
    'select id::text, subject_id::text, target_grade, is_test, created_at::text, updated_at::text from spm_targets where user_id = $1 order by subject_id',
    [userId],
  )

describe('AC1 GET /api/spm-targets shape', () => {
  it('is 401 without a session', async () => {
    expectError(await t.http().get('/api/spm-targets'), 'UNAUTHORIZED')
  })

  it('lists the 20 SPM subjects of BR-22 in order, all "Belum mula" with no target, and parses with the contract', async () => {
    const c = await loginAs(t, 'student')
    const res = await c.get('/api/spm-targets')
    expect(res.status).toBe(200)
    const rows = Envelope.parse(res.body).data.subjects
    expect(rows.map((r) => r.id)).toEqual(order)
    expect(rows).toHaveLength(20)
    expect(rows[0]).toEqual({ id: ids.BA, name: 'Bahasa Arab', target: null, answered: 0, accuracyPct: null, band: null, predictedGrade: null })
    expect(rows[19]).toMatchObject({ id: ids.TI, name: 'Tasawwur Islam' })
    expect(rows.every((r) => r.target === null && r.answered === 0 && r.accuracyPct === null && r.band === null && r.predictedGrade === null)).toBe(true)
  })

  it('every role with a session may read it (guru, admin)', async () => {
    for (const who of ['teacher', 'admin'] as const) expect((await (await loginAs(t, who)).get('/api/spm-targets')).status).toBe(200)
  })
})

describe('AC6 PUT /api/spm-targets', () => {
  it('saves, answers { data: { saved: 20 }, status } and replaces all 20 values (BR-26)', async () => {
    const c = await loginAs(t, 'student2')
    const res = await c.put('/api/spm-targets', { targets: { [ids.BM as string]: 'A', [ids.MATH as string]: 'B+', [ids.BA as string]: '', [ids.SEJ as string]: 'E' } })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.body).toEqual({ data: { saved: 20 }, status: 'Target berjaya disimpan.' })
    PracticeReadSpmTargetsSaveResponseSchema.parse(res.body)
    expect(await targetsOf(c)).toEqual({ [ids.BM as string]: 'A', [ids.MATH as string]: 'B+', [ids.SEJ as string]: 'E' })
    // The second save replaces everything: an empty value clears, a missing subject clears.
    const again = await c.put('/api/spm-targets', { targets: { [ids.BM as string]: '', [ids.MATH as string]: 'C', [ids.TI as string]: 'A+' } })
    expect(again.status).toBe(200)
    expect(await targetsOf(c)).toEqual({ [ids.MATH as string]: 'C', [ids.TI as string]: 'A+' })
  })

  it('accepts all nine grades, and an empty targets object clears every target', async () => {
    const c = await loginAs(t, 'student2')
    const all = Object.fromEntries(PRACTICE_READS_SPM_GRADES.map((g, i) => [order[i], g]))
    expect((await c.put('/api/spm-targets', { targets: all })).status).toBe(200)
    expect(await targetsOf(c)).toEqual(all)
    expect((await c.put('/api/spm-targets', { targets: {} })).status).toBe(200)
    expect(await targetsOf(c)).toEqual({})
  })

  it('is 422 "Gred target tidak sah." for a bad grade, subject or body, and nothing is saved', async () => {
    const c = await loginAs(t, 'student2')
    const bm = ids.BM as string
    await c.put('/api/spm-targets', { targets: { [bm]: 'A' } })
    const outside = await subjectIdOf(t.db, 'SK') // a real subject that is not one of the 20
    const bad: [string, unknown][] = [
      ['grade F', { targets: { [bm]: 'F' } }],
      ['grade lower case', { targets: { [bm]: 'a' } }],
      ['grade not a string', { targets: { [bm]: 5 } }],
      ['null grade', { targets: { [bm]: null } }],
      ['subject outside the 20', { targets: { [outside]: 'A' } }],
      ['subject not a number', { targets: { abc: 'A' } }],
      ['non-canonical key', { targets: { [`0${bm}`]: 'A' } }],
      ['unknown subject id', { targets: { '999999': 'A' } }],
      ['no targets', {}],
      ['targets an array', { targets: ['A'] }],
      ['targets a string', { targets: 'A' }],
    ]
    for (const [name, body] of bad) {
      const res = await c.put('/api/spm-targets', body)
      const err = expectError(res, 'VALIDATION_ERROR', 'Gred target tidak sah.')
      expect(err.fields, name).toBeDefined()
    }
    // The field names the offending key.
    const res = await c.put('/api/spm-targets', { targets: { [ids.MATH as string]: 'B', [bm]: 'Z' } })
    expect(expectError(res, 'VALIDATION_ERROR').fields).toEqual({ [`targets.${bm}`]: 'Gred target tidak sah.' })
    // One bad value among good ones saves none of them.
    expect(await targetsOf(c)).toEqual({ [bm]: 'A' })
  })

  it('is idempotent: the same body twice gives the same response, the same stored rows (ids and timestamps) and no extra rows', async () => {
    const c = await loginAs(t, 'student')
    const body = { targets: { [ids.BM as string]: 'A', [ids.MATH as string]: 'B+', [ids.SEJ as string]: 'A-' } }
    const first = await c.put('/api/spm-targets', body)
    const rows1 = await rowsOf(c.userId)
    t.clock.advance(5 * 60_000)
    const second = await c.put('/api/spm-targets', body)
    const rows2 = await rowsOf(c.userId)
    expect(second.status).toBe(200)
    expect(second.body).toEqual(first.body)
    expect(rows2).toEqual(rows1)
    expect(rows2).toHaveLength(3)
    // A changed grade moves updated_at of that row only.
    await c.put('/api/spm-targets', { targets: { ...body.targets, [ids.MATH as string]: 'A' } })
    const rows3 = await rowsOf(c.userId)
    const math = rows3.find((r) => r.subject_id === ids.MATH)
    expect(math?.target_grade).toBe('A')
    expect(math?.updated_at).not.toBe(rows1.find((r) => r.subject_id === ids.MATH)?.updated_at)
    expect(rows3.find((r) => r.subject_id === ids.BM)).toEqual(rows1.find((r) => r.subject_id === ids.BM))
    await c.put('/api/spm-targets', body)
  })
})

describe('AC4 own targets only', () => {
  it('saving as one student leaves another untouched; a teacher and an admin see only their own', async () => {
    const a = await loginAs(t, 'student')
    const b = await loginAs(t, 'student2')
    await a.put('/api/spm-targets', { targets: { [ids.BM as string]: 'A' } })
    await b.put('/api/spm-targets', { targets: { [ids.BM as string]: 'D' } })
    expect(await targetsOf(a)).toEqual({ [ids.BM as string]: 'A' })
    expect(await targetsOf(b)).toEqual({ [ids.BM as string]: 'D' })
    expect(await targetsOf(await loginAs(t, 'teacher'))).toEqual({})
    expect(await targetsOf(await loginAs(t, 'admin'))).toEqual({})
    // A body cannot name another user.
    await a.put('/api/spm-targets', { userId: b.userId, targets: { [ids.BM as string]: 'C' } })
    expect(await targetsOf(b)).toEqual({ [ids.BM as string]: 'D' })
  })
})

describe('AC9 CSRF, roles and Mod Pelajar', () => {
  it('PUT without a session is 401, without the CSRF token 403 CSRF_INVALID (nothing saved)', async () => {
    expectError(await t.http().put('/api/spm-targets').send({ targets: {} }), 'UNAUTHORIZED')
    const c = await loginAs(t, 'student2')
    await c.put('/api/spm-targets', { targets: { [ids.BM as string]: 'B' } })
    expectCsrfInvalid(await c.noCsrf.put('/api/spm-targets', { targets: {} }))
    expect(await targetsOf(c)).toEqual({ [ids.BM as string]: 'B' })
  })

  it('rows written in Mod Pelajar are stored with is_test; the same user in normal mode stamps them false', async () => {
    const adminId = await userIdOf(t.db, 'admin@demo.test')
    const pelajar = await loginModPelajar(t, 'admin@demo.test')
    expect((await pelajar.put('/api/spm-targets', { targets: { [ids.BM as string]: 'A+' } })).status).toBe(200)
    expect((await rowsOf(adminId)).map((r) => [r.target_grade, r.is_test])).toEqual([['A+', true]])
    // Own history still shows it.
    expect(await targetsOf(pelajar)).toEqual({ [ids.BM as string]: 'A+' })
    // The same grade written outside Mod Pelajar clears the flag (a row is test data only while written in test mode).
    const normal = await loginAs(t, 'admin')
    expect((await normal.put('/api/spm-targets', { targets: { [ids.BM as string]: 'A+' } })).status).toBe(200)
    expect((await rowsOf(adminId)).map((r) => r.is_test)).toEqual([false])
    const student = await rowsOf(await userIdOf(t.db, 'pelajar@demo.test'))
    expect(student.every((r) => r.is_test === false)).toBe(true)
  })
})

describe('table constraints (migration 0022)', () => {
  it('has the unique (user, subject) pair, the grade check and the legacy unique pair', async () => {
    const uid = await userIdOf(t.db, 'guru@demo.test')
    const sid = ids.BM as string
    await t.db.query(`insert into spm_targets (user_id, subject_id, target_grade) values ($1, $2, 'A')`, [uid, sid])
    await expect(t.db.query(`insert into spm_targets (user_id, subject_id, target_grade) values ($1, $2, 'B')`, [uid, sid])).rejects.toThrow(/uq_spm_targets_user_id_subject_id/)
    await expect(t.db.query(`insert into spm_targets (user_id, subject_id, target_grade) values ($1, $2, 'F')`, [uid, ids.BI])).rejects.toThrow(/ck_spm_targets_target_grade/)
    await t.db.query(`insert into spm_targets (user_id, subject_id, target_grade, legacy_source, legacy_id) values ($1, $2, 'A', 'cloud', 'x1')`, [uid, ids.BI])
    await expect(
      t.db.query(`insert into spm_targets (user_id, subject_id, target_grade, legacy_source, legacy_id) values ($1, $2, 'A', 'cloud', 'x1')`, [uid, ids.MATH]),
    ).rejects.toThrow(/uq_spm_targets_legacy/)
    await t.db.query('delete from spm_targets where user_id = $1', [uid])
  })
})

describe('AC9 rate limit', () => {
  it('the PUT is limited per user: the 4th write in the window is 429 RATE_LIMITED with Retry-After; another user and the reads are unaffected', async () => {
    const limited = await bootWritesApp({ env: { THROTTLE_SPM_TARGETS_WRITE_PER_MINUTE: '3' } })
    try {
      const a = await loginAs(limited, 'student')
      const b = await loginAs(limited, 'student2')
      expect((await a.noCsrf.put('/api/spm-targets', { targets: {} })).status).toBe(403) // a refused request does not count
      for (let i = 0; i < 3; i++) expect((await a.put('/api/spm-targets', { targets: {} })).status).toBe(200)
      const res = await a.put('/api/spm-targets', { targets: {} })
      const err = expectError(res, 'RATE_LIMITED')
      expect(typeof err.retryAfter).toBe('number')
      expect(res.headers['retry-after']).toBe(String(err.retryAfter))
      expect((await a.get('/api/spm-targets')).status).toBe(200)
      expect((await b.put('/api/spm-targets', { targets: {} })).status).toBe(200)
      limited.clock.advance(61_000)
      expect((await a.put('/api/spm-targets', { targets: {} })).status).toBe(200)
    } finally {
      await limited.close()
    }
  }, 120_000)
})
