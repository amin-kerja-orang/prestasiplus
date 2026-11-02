import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { ACCOUNTS } from '../exam-builder/helpers'
import { bootFullApp, loginFull, type FullApp, type FullClient } from './full-app'

vi.setConfig({ testTimeout: 120_000, hookTimeout: 300_000 })

/**
 * REQ-B-076 (approve gate). `addVersion` carries `source_paper_id` to version n+1 and a source takedown (`source_papers.takedown_at`) archived only the
 * versions that existed then, so a version re-approved later was live again. Every transition into approved now runs the one merged approve gate, which refuses
 * a version whose source paper is taken down (`fields.source`); no override in R1. Single route, bulk (a `failed[]` row), and the untouched-source control.
 */
const REFUSED = 'Sumber soalan ini telah ditarik balik, jadi soalan tidak boleh diterbitkan.'

describe('REQ-B-076: the approve gate refuses a version whose source paper is taken down', () => {
  let t: FullApp
  let admin: FullClient
  let subject: string
  let level: string
  let tag: { unitId: string; spIds: string[]; tp: number }
  let counter = 0

  const q = (sql: string, params: unknown[] = []) => t.db.query<Record<string, unknown>>(sql, params)
  const one = async (sql: string) => String((await q(sql))[0]!.id)
  const body = () => ({
    subjectId: subject,
    educationLevelId: level,
    difficultyLevel: 3,
    questionType: 'mcq',
    questionText: `Soalan gerbang sumber ${String(counter++)}: berapakah ${String(counter + 1)} + 2?`,
    options: ['3', '4', '5', '6'],
    correctAnswer: 1,
    explanation: 'Penjelasan ujian.',
    cognitiveLevel: 'mengaplikasi',
    kertas: '2',
    tag,
  })
  const chapterize = (id: string) =>
    q(
      `update question_versions set chapter_id = (select id from chapters where subject_id = $2::bigint and education_level_id = $3::bigint order by id limit 1) where question_id = $1::bigint and chapter_id is null`,
      [id, subject, level],
    )
  const draft = async (stemTag = ''): Promise<string> => {
    const res = await admin.post('/api/questions', stemTag === '' ? body() : { ...body(), questionText: `${stemTag} ${body().questionText}` })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const id = res.body.data.id as string
    await chapterize(id)
    return id
  }
  const source = async (takenDown: boolean): Promise<string> => one(`insert into source_papers (rights_status${takenDown ? ', takedown_at' : ''}) values ('own'${takenDown ? ', now()' : ''}) returning id::text id`)
  const attach = (id: string, sourceId: string, versionNo = 1) => q(`update question_versions set source_paper_id = ${sourceId} where question_id = ${id} and version_no = ${String(versionNo)}`)
  const status = async (id: string) => String((await q(`select status from question_versions where question_id = ${id} order by version_no desc limit 1`))[0]!.status)
  const toReview = async (id: string) => expect((await admin.post(`/api/questions/${id}/status`, { to: 'review' })).status).toBe(200)

  beforeAll(async () => {
    t = await bootFullApp()
    admin = await loginFull(t, ACCOUNTS.admin)
    subject = await one(`select id::text id from subjects where code = 'MATH'`)
    level = await one(`select id::text id from education_levels where code = 'T4'`)
    const unit = await one(`select id::text id from curriculum_nodes where kind = 'unit' and subject_id = ${subject} and education_level_id = ${level} order by sort_order, id limit 1`)
    const sp = await one(`select id::text id from curriculum_nodes where kind = 'sp' and subject_id = ${subject} and education_level_id = ${level} order by sort_order, id limit 1`)
    tag = { unitId: unit, spIds: [sp], tp: 3 }
  })
  afterAll(async () => {
    await t.close()
  })

  it('control: a version of a source that is not taken down is approved (single route)', async () => {
    const id = await draft()
    await attach(id, await source(false))
    await toReview(id)
    const res = await admin.post(`/api/questions/${id}/status`, { to: 'approved' })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(await status(id)).toBe('approved')
  })

  it('single route: Terbitkan of a version whose source is taken down is 422 with the BM line on `source`; the question stays in Semakan', async () => {
    const id = await draft()
    await attach(id, await source(true))
    await toReview(id)
    const res = await admin.post(`/api/questions/${id}/status`, { to: 'approved' })
    expect(res.status, JSON.stringify(res.body)).toBe(422)
    expect(JSON.stringify(res.body)).toContain(REFUSED)
    expect(await status(id)).toBe('review')
  })

  it('the real path: v1 approved, the source is taken down, an edit makes v2 (the source id is carried), and v2 cannot be approved', async () => {
    const id = await draft()
    const sourceId = await source(false)
    await attach(id, sourceId)
    await toReview(id)
    expect((await admin.post(`/api/questions/${id}/status`, { to: 'approved' })).status).toBe(200)
    await q(`update source_papers set takedown_at = now() where id = ${sourceId}`)
    const edit = await admin.put(`/api/questions/${id}`, { ...body(), questionText: 'Versi dua selepas sumber ditarik: berapakah 9 + 1?' })
    expect(edit.status, JSON.stringify(edit.body)).toBe(200)
    expect((await q(`select source_paper_id::text sp from question_versions where question_id = ${id} and version_no = 2`))[0]?.sp, 'v2 carries the source').toBe(sourceId)
    await chapterize(id)
    await toReview(id)
    const res = await admin.post(`/api/questions/${id}/status`, { to: 'approved' })
    expect(res.status, JSON.stringify(res.body)).toBe(422)
    expect(JSON.stringify(res.body)).toContain(REFUSED)
    expect((await q(`select live_version_no n from questions where id = ${id}`))[0]?.n, 'v1 stays the live one; v2 never went live').toBe(1)
  })

  it('bulk Terbitkan: the taken-down row is a failed[] entry (code, message, fields.source), the untouched row is published', async () => {
    const bad = await draft()
    const good = await draft()
    await attach(bad, await source(true))
    await attach(good, await source(false))
    for (const id of [bad, good]) await toReview(id)
    const res = await admin.post('/api/questions/bulk-action', { action: 'approved', ids: [bad, good] })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.body.data.affected).toBe(1)
    expect(res.body.data.failed).toHaveLength(1)
    expect(res.body.data.failed[0]).toMatchObject({ id: bad, code: 'VALIDATION_ERROR', fields: { source: REFUSED } })
    expect(await status(bad)).toBe('review')
    expect(await status(good)).toBe('approved')
  })

  it('the bulk FILTER route (Luluskan Hasil Tapisan) refuses the taken-down row the same way: failed[] with fields.source, the other row is published', async () => {
    const bad = await draft('FILTERGATE76')
    const good = await draft('FILTERGATE76')
    await attach(bad, await source(true))
    await attach(good, await source(false))
    for (const id of [bad, good]) await toReview(id)
    const res = await admin.post('/api/questions/bulk-action/filter', { action: 'approved', filter: { search: 'FILTERGATE76' }, expectedCount: 2 })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.body.data).toMatchObject({ matched: 2, affected: 1 })
    expect(res.body.data.failed).toHaveLength(1)
    expect(res.body.data.failed[0]).toMatchObject({ id: bad, code: 'VALIDATION_ERROR', fields: { source: REFUSED } })
    expect(await status(bad)).toBe('review')
    expect(await status(good)).toBe('approved')
  })

  it('gate-check (approve) lists the taken-down source as SOURCE_TAKEN_DOWN on step 1, and is clean for an untouched source', async () => {
    const bad = await draft()
    const good = await draft()
    await attach(bad, await source(true))
    await attach(good, await source(false))
    const refused = await admin.get(`/api/questions/${bad}/gate-check?gate=approve`)
    expect(refused.status, JSON.stringify(refused.body)).toBe(200)
    expect(JSON.stringify(refused.body)).toContain('SOURCE_TAKEN_DOWN')
    expect(JSON.stringify(refused.body)).toContain(REFUSED)
    expect(JSON.stringify((await admin.get(`/api/questions/${good}/gate-check?gate=approve`)).body)).not.toContain('SOURCE_TAKEN_DOWN')
  })

  // Create-as-approved is not tested over HTTP on purpose: `POST /api/questions` takes no source id (only the intake accept carries one, and it creates a Draf),
  // so that branch of `createFrom` can only see a taken-down source through the service; it asks `QuestionsRepository.sourceTakenDown` for the provenance id.
})
