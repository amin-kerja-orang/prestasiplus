import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { BijakProgressSource, PaperProgress } from '../../src/modules/bijak/papers'
import { BijakPapersAttemptSource } from '../../src/modules/bijak/papers'
import { bootPapersApp, expectError, loginAs, type Client, type PapersTestApp } from './helpers'

/** S3-T07, AC-PA-36 clause (b): the Bijak list and every by-id open follow `papers.level_scope` by the pupil's form (`users.grade`). */
const sat = new Map<string, PaperProgress>()
const fakeProgress: BijakProgressSource = { progressFor: async (_u, ids) => new Map([...sat].filter(([id]) => ids.includes(id))) }

describe('Bijak papers follow level_scope by the pupil form (S3-T07)', () => {
  let t: PapersTestApp
  let pupil: Client
  let source: BijakPapersAttemptSource

  beforeAll(async () => {
    t = await bootPapersApp({ progress: fakeProgress })
    pupil = await loginAs(t, 'pelajar@demo.test')
    source = t.app.get(BijakPapersAttemptSource)
    // The four seeded PoC papers: scope them t4, t5, t4_t5 and NULL.
    await t.db.query(`update papers set level_scope = null where kind = 'pilihan'`)
    await t.db.query(`update papers set level_scope = 't4' where paper_code = '1449/1'`)
    await t.db.query(`update papers set level_scope = 't5' where paper_code = '1449/2'`)
    await t.db.query(`update papers set level_scope = 't4_t5' where paper_code = '4541/2'`)
  })
  afterAll(async () => {
    await t.close()
  })

  const setGrade = (grade: number | null) => t.db.query(`update users set grade = $1 where id = $2`, [grade, pupil.userId])
  const listed = async (): Promise<string[]> => {
    const res = await pupil.get('/api/bijak/papers')
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    return (res.body.data as { code: string }[]).map((p) => p.code).sort()
  }
  const idOf = async (code: string): Promise<string> => {
    const rows = await t.db.query<{ id: string }>(`select id::text from papers where paper_code = $1 and kind = 'pilihan'`, [code])
    return rows[0]?.id as string
  }

  it('a T3 pupil sees only the NULL-scoped papers', async () => {
    await setGrade(9)
    expect(await listed()).toEqual(['1249/2'])
  })

  it('a T4 pupil sees t4, t4_t5 and NULL', async () => {
    await setGrade(10)
    expect(await listed()).toEqual(['1249/2', '1449/1', '4541/2'])
  })

  it('a T5 pupil sees t5, t4_t5 and NULL', async () => {
    await setGrade(11)
    expect(await listed()).toEqual(['1249/2', '1449/2', '4541/2'])
  })

  it('a pupil with no form sees the NULL-scoped papers only; none visible is an empty list', async () => {
    await setGrade(null)
    expect(await listed()).toEqual(['1249/2'])
    await t.db.query(`update papers set status = 'draft' where paper_code = '1249/2'`)
    expect(await listed()).toEqual([])
    await t.db.query(`update papers set status = 'published' where paper_code = '1249/2'`)
  })

  it('does not list a subjektif paper', async () => {
    await setGrade(10)
    await t.db.query(`update papers set surface = 'subjektif' where paper_code = '1249/2'`)
    expect(await listed()).toEqual(['1449/1', '4541/2'])
    await t.db.query(`update papers set surface = 'simulasi' where paper_code = '1249/2'`)
  })

  it('opening a hidden paper by id answers 404 (cover and start); a visible one opens', async () => {
    await setGrade(10)
    const hidden = await idOf('1449/2')
    expectError(await pupil.get(`/api/bijak/papers/${hidden}`), 'NOT_FOUND', 404, 'Kertas tidak ditemui')
    expect(await source.resolveForAttempt({ userId: pupil.userId, paperId: hidden, isTest: false })).toEqual({ ok: false, reason: 'not_found' })
    const visible = await idOf('1449/1')
    expect((await pupil.get(`/api/bijak/papers/${visible}`)).status).toBe(200)
    expect((await source.resolveForAttempt({ userId: pupil.userId, paperId: visible, isTest: false })).ok).toBe(true)
    await setGrade(11)
    expect((await pupil.get(`/api/bijak/papers/${hidden}`)).status).toBe(200)
  })

  it('keeps a paper the pupil already sat on: listed, cover OK, but a new start is 404 (re-scoped or promoted)', async () => {
    await setGrade(9)
    const id = await idOf('1449/1')
    expect(await listed()).not.toContain('1449/1')
    sat.set(id, { lastScore: { score: 5, max: 10 } })
    expect(await listed()).toEqual(['1249/2', '1449/1'])
    expect((await pupil.get(`/api/bijak/papers/${id}`)).status).toBe(200)
    expect(await source.resolveForAttempt({ userId: pupil.userId, paperId: id, isTest: false })).toEqual({ ok: false, reason: 'not_found' })
    sat.clear()
    expectError(await pupil.get(`/api/bijak/papers/${id}`), 'NOT_FOUND', 404, 'Kertas tidak ditemui')
  })

  it('shows no subject that has no visible paper (subject hub)', async () => {
    await t.db.query(`update blueprints set status = 'retired'`)
    await setGrade(9)
    const codes = async () => ((await pupil.get('/api/bijak/subjects')).body.data as { code: string }[]).map((s) => s.code).sort()
    const forT3 = await codes()
    await setGrade(10)
    expect((await codes()).length).toBeGreaterThanOrEqual(forT3.length)
    await t.db.query(`update papers set level_scope = 't5'`)
    await setGrade(9)
    expect(await codes()).toEqual([])
  })
})
